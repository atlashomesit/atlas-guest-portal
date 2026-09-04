import { isRewriteEligibleHost, buildMetaRewriteValues, type TenantSiteMeta } from "./_lib/tenantSiteMeta";
import { TtlCache } from "./_lib/ttlCache";

/**
 * TASK-4905 / ADR-0018 (2026-07-16 amendment): root-level Cloudflare Pages Function middleware.
 * Runs for every request to the `atlas-guest-portal` Pages project (Pages Functions convention:
 * a root `_middleware.ts` wraps the whole site, including nested route Functions and the SPA
 * static-asset fallback). Intercepts the eventual HTML response and rewrites `og:title` /
 * `og:description` / `og:image` / `og:url` / `twitter:*` / `<link rel="canonical">` / `<title>`
 * to the resolved tenant's own property meta, so WhatsApp's (and any other) non-JS link-unfurling
 * crawler sees THAT tenant's name/description/photo instead of Atlas's static fallback.
 *
 * Does NOT replace the existing runtime DOM rewrite (`SEO.tsx`/`TenantJsonLd.tsx`, ADR-0018
 * Option 3) — both layers remain active; this one only matters for clients that never execute the
 * SPA's JavaScript.
 *
 * FAIL-OPEN CONTRACT (hard requirement): every branch below that could throw — content-type
 * sniffing, host parsing, the API fetch, JSON parsing, and the HTMLRewriter transform itself — is
 * wrapped in the outer `try/catch`. ANY failure returns the original, untouched response. A bug
 * in this file can never take the portal down; at worst a social-preview shows Atlas's default
 * tags instead of the tenant's own, which is the exact behavior before this task shipped.
 */

interface Env {
  ATLAS_API_BASE_URL?: string;
  /** TASK-7207 / ADR-0096: shared secret the Worker sends as X-Atlas-Worker-Proxy. */
  ATLAS_WORKER_PROXY_SECRET?: string;
}

// Minimal local typing for the Cloudflare Workers runtime's HTMLRewriter global — deliberately
// NOT importing `@cloudflare/workers-types` (matches the existing convention in
// `functions/assets/[[path]].ts`: no build-time dependency on Workers types; this file is bundled
// by `wrangler pages functions build`, which provides the real global at runtime, and is outside
// `tsconfig.app.json`'s `include` so it is not part of `npm run typecheck` either).
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
  remove(): void;
}
interface RewriterElementHandlers {
  element(el: RewriterElement): void;
}
declare class HTMLRewriter {
  on(selector: string, handlers: RewriterElementHandlers): HTMLRewriter;
  transform(response: Response): Response;
}

// ADR-0018 amendment: "cache ... for a short TTL (e.g. 5 minutes)".
const SITE_META_TTL_MS = 5 * 60 * 1000;

// `null` is cached too (a resolved "no tenant meta for this host" — 404/unresolved) so a
// mistyped or attacker-probed host does not trigger an API round-trip on every crawler hit.
const siteMetaCache = new TtlCache<TenantSiteMeta | null>(SITE_META_TTL_MS);

/** TASK-10164: path-aware clickjacking policy — embed routes stay framable; everything else 'none'. */
function isEmbedFramablePath(pathname: string): boolean {
  return pathname === "/embed.js" || pathname.startsWith("/embed/");
}

function stripFrameAncestors(csp: string): string {
  return csp
    .replace(/frame-ancestors\s+[^;]+;?/gi, "")
    .replace(/;\s*;/g, ";")
    .replace(/^\s*;\s*/, "")
    .replace(/;\s*$/, "")
    .trim();
}

function mergeFrameAncestorsIntoCsp(csp: string, frameAncestors: string): string {
  const without = stripFrameAncestors(csp);
  const directive = `frame-ancestors ${frameAncestors}`;
  if (!without) return directive;
  return `${without.replace(/;?\s*$/, "")}; ${directive}`;
}

function collectCspValues(headers: Headers): string[] {
  const values: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-security-policy") values.push(value);
  });
  return values;
}

function applyFrameProtection(request: Request, response: Response): Response {
  const pathname = new URL(request.url).pathname;
  const embed = isEmbedFramablePath(pathname);
  const frameAncestors = embed ? "https: http:" : "'none'";
  const xfo = embed ? "ALLOWALL" : "SAMEORIGIN";

  const headers = new Headers(response.headers);
  const csps = collectCspValues(headers);
  headers.delete("content-security-policy");
  const base = csps[0] ?? "";
  headers.set("content-security-policy", mergeFrameAncestorsIntoCsp(base, frameAncestors));
  headers.set("x-frame-options", xfo);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchTenantSiteMeta(host: string, apiBase: string): Promise<TenantSiteMeta | null> {
  const cached = siteMetaCache.get(host);
  if (cached !== undefined) return cached;

  const res = await fetch(`${apiBase}/api/public/tenant-site-meta?domain=${encodeURIComponent(host)}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    // 404 (unresolved host) or any upstream error — cache the negative result too, still short TTL.
    siteMetaCache.set(host, null);
    return null;
  }

  const meta = (await res.json()) as TenantSiteMeta;
  siteMetaCache.set(host, meta);
  return meta;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> => {
  const response = await context.next();
  // TASK-10164: clickjacking headers must apply even when the OG rewrite fail-opens.
  const framed = applyFrameProtection(context.request, response);

  try {
    // Only HTML documents carry OG/meta tags — every other response (API JSON, sitemap.xml,
    // hashed JS/CSS assets, images, the /.well-known runtime-config, etc.) passes through
    // untouched and never triggers the API round-trip below.
    const contentType = framed.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return framed;

    const url = new URL(context.request.url);
    // TASK-7170 / TASK-7207 / ADR-0096: through the `tenant-subdomain-router` Worker the request
    // URL is the Pages origin (atlas-guest-portal.pages.dev) and the public tenant host arrives
    // via `X-Forwarded-Host`. Prefer it ONLY when provenance is proven:
    //   1. URL host is the Pages origin the Worker fetches (`*.pages.dev`), AND
    //   2. `X-Atlas-Worker-Proxy` equals `ATLAS_WORKER_PROXY_SECRET` (not a well-known proxy header).
    // Absent/mismatched secret → ignore `X-Forwarded-Host` (byte-identical to pre-TASK-7170).
    // Direct custom-domain / apex traffic never traverses the Worker and must not honour the header.
    const isWorkerProxiedOrigin = url.hostname.toLowerCase().endsWith(".pages.dev");
    const expectedSecret = (context.env.ATLAS_WORKER_PROXY_SECRET ?? "").trim();
    const proxyHeader = (context.request.headers.get("x-atlas-worker-proxy") ?? "").trim();
    const workerProvenanceOk =
      isWorkerProxiedOrigin && expectedSecret.length > 0 && proxyHeader === expectedSecret;
    const forwardedHost = workerProvenanceOk
      ? (context.request.headers.get("x-forwarded-host") ?? "").trim().toLowerCase()
      : "";
    const host = forwardedHost || url.hostname.toLowerCase();

    // Atlas first-party hosts (marketplace apex + Atlas direct-booking domains) keep their
    // existing static/runtime OG tags — no API call, no rewrite.
    if (!isRewriteEligibleHost(host)) return framed;

    const apiBase = (context.env.ATLAS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
    if (!apiBase) return framed; // misconfigured Pages env — fail open, not a 500

    const meta = await fetchTenantSiteMeta(host, apiBase);
    if (!meta) return framed; // unresolved host / API error — fail open to existing tags

    const values = buildMetaRewriteValues(meta, url.toString());

    const rewriter = new HTMLRewriter()
      .on("title", {
        element(el: RewriterElement) {
          el.setInnerContent(values.title);
        },
      })
      .on('meta[name="description"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.description);
        },
      })
      .on('meta[property="og:title"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.title);
        },
      })
      .on('meta[property="og:description"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.description);
        },
      })
      .on('meta[property="og:image"]', {
        element(el: RewriterElement) {
          // TASK-7468 #5: omit Atlas-branded fallback on tenant hosts when no listing photo.
          if (values.image) el.setAttribute("content", values.image);
          else el.remove();
        },
      })
      .on('meta[property="og:url"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.url);
        },
      })
      .on('link[rel="canonical"]', {
        element(el: RewriterElement) {
          el.setAttribute("href", values.canonical);
        },
      })
      .on('meta[name="twitter:title"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.title);
        },
      })
      .on('meta[name="twitter:description"]', {
        element(el: RewriterElement) {
          el.setAttribute("content", values.description);
        },
      })
      .on('meta[name="twitter:image"]', {
        element(el: RewriterElement) {
          if (values.image) el.setAttribute("content", values.image);
          else el.remove();
        },
      });

    return applyFrameProtection(context.request, rewriter.transform(framed));
  } catch {
    // See FAIL-OPEN CONTRACT above — never let this Function break the page.
    return framed;
  }
};
