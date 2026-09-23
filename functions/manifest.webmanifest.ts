import type { TenantSiteMeta } from "./_lib/tenantSiteMeta";
import { isRewriteEligibleHost } from "./_lib/tenantSiteMeta";

/**
 * TASK-102425: dynamic PWA manifest per tenant host. The static
 * `public/manifest.webmanifest` names every install "Atlastays" — a Royal Oak Stays
 * guest ends up with an "Atlastays" icon on their homescreen. This Function route
 * takes precedence over the static file and returns the tenant's own brand name
 * (from the same `GET /api/public/tenant-site-meta` the OG middleware uses) with
 * the tenant photo as icon when present.
 *
 * FAIL-OPEN: any failure (no API base, unresolved host, fetch error) returns the
 * exact static-manifest equivalent, so installs never break.
 */

interface Env {
  ATLAS_API_BASE_URL?: string;
}

const FALLBACK_MANIFEST = {
  name: "Atlastays",
  short_name: "Atlastays",
  description:
    "Direct booking for serviced apartments and homestays — zero booking fees, instant WhatsApp confirmation, verified properties.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#ffffff",
  theme_color: "#ea580c",
  icons: [
    { src: "/icons/logo192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/logo512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ],
  categories: ["travel", "lifestyle", "business"],
  lang: "en-IN",
  dir: "ltr",
};

function manifestFor(meta: TenantSiteMeta | null): Record<string, unknown> {
  if (!meta) return FALLBACK_MANIFEST;
  const name = meta.propertyName?.trim() || meta.tenantSlug;
  const icons = meta.photoUrl
    ? [
        { src: meta.photoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: meta.photoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : FALLBACK_MANIFEST.icons;
  return {
    ...FALLBACK_MANIFEST,
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: meta.description?.trim() || FALLBACK_MANIFEST.description,
    icons,
  };
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const respond = (manifest: Record<string, unknown>) =>
    new Response(JSON.stringify(manifest), {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });

  try {
    const url = new URL(context.request.url);
    const host = url.hostname.toLowerCase();
    if (!isRewriteEligibleHost(host)) return respond(FALLBACK_MANIFEST);

    const apiBase = (context.env.ATLAS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
    if (!apiBase) return respond(FALLBACK_MANIFEST);

    const res = await fetch(
      `${apiBase}/api/public/tenant-site-meta?domain=${encodeURIComponent(host)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return respond(FALLBACK_MANIFEST);
    const meta = (await res.json()) as TenantSiteMeta;
    return respond(manifestFor(meta));
  } catch {
    return respond(FALLBACK_MANIFEST);
  }
};
