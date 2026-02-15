import { onRequestGet, SITEMAP_PATHS } from "../functions/sitemap.xml";

describe("sitemap.xml endpoint", () => {
  it("returns XML with core and home paths", async () => {
    const response = await onRequestGet({ request: new Request("https://example.com/sitemap.xml") });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const body = await response.text();

    expect(body).toContain("<loc>https://example.com/</loc>");
    expect(body).toContain("<loc>https://example.com/contact</loc>");
    expect(body).toContain("<loc>https://example.com/homes/atlas-homes-room-101/101</loc>");
    expect(body).not.toContain("<loc>https://example.com/apartments</loc>");

    // Spot check that every configured path is represented
    SITEMAP_PATHS.forEach((path) => {
      expect(body).toContain(`<loc>https://example.com${path}</loc>`);
    });
  });
});
