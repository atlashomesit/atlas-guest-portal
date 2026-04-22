import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Generates a sitemap.xml from local catalog data (propertyData) so SEO stays current
// even when the public listings API is not reachable at build time.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");

// IMPORTANT: do not import src/data.ts directly in Node. It can include browser-only deps (react-icons)
// and bundler-specific resolution. Instead, parse listingId + property_name from source text.
const dataPath = path.join(repoRoot, "src", "data.ts");
const dataText = readFileSync(dataPath, "utf8");

const propertyRows = Array.from(dataText.matchAll(/listingId:\s*([0-9]+)[\s\S]*?property_name:\s*\"([^\"]+)\"/g));
const propertyData = propertyRows.map((m) => ({
  listingId: Number(m[1]),
  property_name: String(m[2]),
}));

const origin = "https://atlashomestays.com";
const now = new Date().toISOString();

const staticUrls = [
  "/",
  "/search",
  "/offers",
  "/about",
  "/faq",
  "/contact",
  "/terms",
  "/policies",
  "/privacy",
  "/blog",
];

const listingUrls = propertyData
  .map((p) => {
    const listingId = Number(p.listingId);
    const propertySlug = String(p.property_name ?? "home")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
    if (!Number.isFinite(listingId) || listingId <= 0) return null;
    return `/homes/${propertySlug}/${listingId}`;
  })
  .filter(Boolean);

const urls = [...new Set([...staticUrls, ...listingUrls])];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) =>
        `  <url>\n` +
        `    <loc>${origin}${u}</loc>\n` +
        `    <lastmod>${now}</lastmod>\n` +
        `  </url>`
    )
    .join("\n") +
  `\n</urlset>\n`;

writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf8");
console.log(`[sitemap] wrote ${urls.length} URLs to public/sitemap.xml`);

