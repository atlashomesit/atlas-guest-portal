import { describe, expect, it } from "vitest";
import { buildSitemapXml } from "../../functions/sitemap.xml";

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
});
