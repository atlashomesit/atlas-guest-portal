import { onRequestGet, SHARED_SITEMAP_PATHS } from "../functions/sitemap.xml";

describe("sitemap.xml endpoint", () => {
  it("returns XML with core and home paths", async () => {
    const response = await onRequestGet({
      request: new Request("https://example.com/sitemap.xml"),
      env: {},
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const body = await response.text();

    expect(body).toContain("<loc>https://example.com/</loc>");
    expect(body).toContain("<loc>https://example.com/contact</loc>");
    expect(body).not.toContain("<loc>https://example.com/apartments</loc>");

    // TASK-7194: example.com is neither a marketplace host nor an Atlas direct-booking host,
    // so this response is the WHITE-LABEL sitemap shape — SHARED_SITEMAP_PATHS only. This
    // assertion used to run against SITEMAP_PATHS, which additionally carries the Atlas
    // /homestays-in-* city guides; TASK-7194 stopped emitting those for non-Atlas hosts and
    // this spec was never updated, so it has been failing on dev ever since.
    SHARED_SITEMAP_PATHS.forEach((path) => {
      expect(body).toContain(`<loc>https://example.com${path}</loc>`);
    });

    // ...and the Atlas city guides must NOT leak onto a white-label host (TASK-7194's point).
    expect(body).not.toContain("<loc>https://example.com/homestays-in-goa</loc>");
    expect(body).not.toContain("<loc>https://example.com/homestays-in-hyderabad</loc>");
  });
});
