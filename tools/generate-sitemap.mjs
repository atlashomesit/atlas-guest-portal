import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
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

// CPO-007: tenant builds override the canonical host via SITEMAP_ORIGIN. Default is the
// Atlastays marketplace apex. Cloudflare Pages Function still serves a fully tenant-aware
// sitemap at request time (functions/sitemap.xml.ts) — this static file is only the fallback.
const origin = (process.env.SITEMAP_ORIGIN || "https://atlastays.com").replace(/\/+$/, "");

// lastmod must reflect when a route's *content* actually changed, not when the build ran.
// Stamping `new Date()` on every URL every build produced meaningless churn diffs that the
// pre-run auto-commit agent kept snapshotting into history. Instead derive each URL's lastmod
// from the git last-commit time of the source that determines it:
//   - static marketing routes  -> this generator file (where the route list lives)
//   - listing routes           -> src/data.ts (where listing rows are defined)
// Values are ISO-8601 UTC (spec-compliant) and only change when the source commit changes,
// so an unchanged build leaves public/sitemap.xml byte-identical and git status stays clean.
// If a source is uncommitted or git is unavailable, we omit <lastmod> for that URL rather than
// invent a timestamp — lastmod is optional per the sitemap protocol.
function gitLastmod(relPath) {
  try {
    const seconds = execFileSync("git", ["log", "-1", "--format=%ct", "--", relPath], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!seconds) return null;
    const ms = Number(seconds) * 1000;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

const generatorRel = path.relative(repoRoot, __filename).split(path.sep).join("/");
const dataRel = path.relative(repoRoot, dataPath).split(path.sep).join("/");
const staticLastmod = gitLastmod(generatorRel);
const listingLastmod = gitLastmod(dataRel);

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
  // TASK-1479: SEO city landing pages
  "/homestays-in-goa",
  "/homestays-in-coorg",
  "/homestays-in-hyderabad",
  "/homestays-in-manali",
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

// Build (loc, lastmod) entries, deduping by path. Static routes take precedence on collision.
const entriesByPath = new Map();
for (const u of staticUrls) {
  if (!entriesByPath.has(u)) entriesByPath.set(u, staticLastmod);
}
for (const u of listingUrls) {
  if (!entriesByPath.has(u)) entriesByPath.set(u, listingLastmod);
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [...entriesByPath.entries()]
    .map(
      ([u, lastmod]) =>
        `  <url>\n` +
        `    <loc>${origin}${u}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ``) +
        `  </url>`
    )
    .join("\n") +
  `\n</urlset>\n`;

const urls = [...entriesByPath.keys()];

writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf8");
console.log(`[sitemap] wrote ${urls.length} URLs to public/sitemap.xml`);

