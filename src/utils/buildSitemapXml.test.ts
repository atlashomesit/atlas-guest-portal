import { describe, expect, it } from "vitest";
import { SITEMAP_PATHS, buildSitemapXml, onRequestGet } from "../../functions/sitemap.xml";

describe("buildSitemapXml", () => {
  it("uses the provided base URL for every <loc> entry", () => {
    const baseUrl = "https://example.com";
    const paths = ["/", "/one", "/two", "three/four"]; // mix of rooted and relative

    const xml = buildSitemapXml(baseUrl, paths);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(locs).toHaveLength(paths.length);
    expect(locs.every((loc) => loc.startsWith(baseUrl))).toBe(true);
  });

  it("normalizes slashes when joining the base URL and paths", () => {
    const xml = buildSitemapXml("https://example.com/", ["/", "no-leading-slash"]);

    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/no-leading-slash</loc>");
  });

  it("includes core paths and each home in the sitemap using the request origin", async () => {
    // Home paths come from src/content/homes (href format: /homes/atlas-homes-room-{no}/{no})
    expect(SITEMAP_PATHS).toContain("/homes/atlas-homes-room-101/101");
    expect(SITEMAP_PATHS).not.toContain("/apartments");

    const request = new Request("https://dev.atlashomestays.com/sitemap.xml");
    const response = await onRequestGet({ request });
    const xml = await response.text();

    expect(xml).toContain("<loc>https://dev.atlashomestays.com/</loc>");
    expect(xml).toContain("/homes/atlas-homes-room-101/101</loc>");
    expect(xml).toContain("/amenities</loc>");
    expect(xml).not.toContain("/apartments");
  });
});
