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
}

// Minimal local typing for the Cloudflare Workers runtime's HTMLRewriter global — deliberately
// NOT importing `@cloudflare/workers-types` (matches the existing convention in
// `functions/assets/[[path]].ts`: no build-time dependency on Workers types; this file is bundled
// by `wrangler pages functions build`, which provides the real global at runtime, and is outside
// `tsconfig.app.json`'s `include` so it is not part of `npm run typecheck` either).
interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
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

  try {
    // Only HTML documents carry OG/meta tags — every other response (API JSON, sitemap.xml,
    // hashed JS/CSS assets, images, the /.well-known runtime-config, etc.) passes through
    // untouched and never triggers the API round-trip below.
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return response;

    const url = new URL(context.request.url);
    const host = url.hostname.toLowerCase();

    // Atlas first-party hosts (marketplace apex + Atlas direct-booking domains) keep their
    // existing static/runtime OG tags — no API call, no rewrite.
    if (!isRewriteEligibleHost(host)) return response;

    const apiBase = (context.env.ATLAS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
    if (!apiBase) return response; // misconfigured Pages env — fail open, not a 500

    const meta = await fetchTenantSiteMeta(host, apiBase);
    if (!meta) return response; // unresolved host / API error — fail open to existing tags

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
          el.setAttribute("content", values.image);
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
          el.setAttribute("content", values.image);
        },
      });

    return rewriter.transform(response);
  } catch {
    // See FAIL-OPEN CONTRACT above — never let this Function break the page.
    return response;
  }
};
