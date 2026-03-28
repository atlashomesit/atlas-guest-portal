import { homes } from "../src/content/homes";

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
];

const HOME_PATHS = homes.map((home) => home.href);

export const SITEMAP_PATHS = Array.from(new Set([...CORE_PATHS, ...HOME_PATHS]));

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

export const onRequestGet = ({ request }: { request: Request }) => {
  const baseUrl = new URL(request.url).origin;
  const sitemapXml = buildSitemapXml(baseUrl, SITEMAP_PATHS);

  return new Response(sitemapXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
