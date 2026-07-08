interface Env {
  ATLAS_API_BASE_URL?: string;
  ATLAS_TENANT_KEY?: string;
}

// TASK-4414: city landing pages for SEO acquisition
const CITY_LANDING_SLUGS = ["goa", "coorg", "hyderabad", "manali"] as const;

const CORE_PATHS = [
  "/",
  "/amenities",
  "/location",
  "/gallery",
  "/offers",
  "/blog",
  "/blog/guest-guides",
  "/blog/hospitality-tech",
  "/policies",
  "/contact",
  "/about",
  "/faq",
  "/terms",
  // City landing pages (TASK-4414)
  ...CITY_LANDING_SLUGS.map((slug) => `/homestays-in-${slug}`),
];

// Backward-compatible export used by tests; includes static (always-on) sitemap paths.
export const SITEMAP_PATHS = CORE_PATHS;

export function buildSitemapXml(baseUrl: string, paths: string[]): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  const urlEntries = paths.map((path) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `  <url><loc>${normalizedBase}${normalizedPath}</loc></url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    "</urlset>",
  ].join("\n");
}

function slugify(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const onRequestGet = async ({ request, env }: { request: Request; env?: Env }) => {
  const origin = new URL(request.url).origin;
  const runtimeEnv = env ?? {};
  const apiBase = (runtimeEnv.ATLAS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const tenantKey = (runtimeEnv.ATLAS_TENANT_KEY ?? "").trim();

  const listingPaths: string[] = [];
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/listings/public`, {
        headers: {
          Accept: "application/json",
          ...(tenantKey ? { "X-Tenant-Slug": tenantKey } : {}),
        },
      });
      if (res.ok) {
        const list = (await res.json()) as any[];
        if (Array.isArray(list)) {
          for (const l of list) {
            const id = Number(l?.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            const propertySlug = slugify(String(l?.propertyName ?? l?.name ?? `home-${id}`)) || `home-${id}`;
            listingPaths.push(`/homes/${propertySlug}/${id}`);
          }
        }
      }
    } catch {
      // sitemap still works with core paths only
    }
  }

  const paths = Array.from(new Set([...CORE_PATHS, ...listingPaths]));
  const sitemapXml = buildSitemapXml(origin, paths);

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
