import { guardAssetResponse } from "../functions/_lib/assetGuard";

/**
 * TASK-2748 regression — the /assets/* Pages Function must never let the SPA
 * fallback (index.html, text/html) be served or cached under a hashed asset URL,
 * while leaving real assets (and their immutable caching) untouched.
 */
describe("guardAssetResponse (TASK-2748)", () => {
  it("rewrites an SPA-fallback HTML response into an uncacheable 404", async () => {
    const fallbackHtml = new Response("<!doctype html><html><head></head><body></body></html>", {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Exactly the poisoning header the /assets/* _headers rule would apply.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    const guarded = guardAssetResponse(fallbackHtml);

    expect(guarded.status).toBe(404);
    expect(guarded.headers.get("Content-Type")).toContain("text/plain");
    // Critical: the 404 must NOT be cacheable, or it would outlive the
    // propagation window and keep the asset broken for up to a year.
    expect(guarded.headers.get("Cache-Control")).toBe("no-store");
    expect(guarded.headers.get("Cache-Control")).not.toContain("immutable");
    expect(await guarded.text()).not.toContain("<html");
  });

  it("passes a real stylesheet through untouched (keeps immutable caching)", () => {
    const css = new Response(".x{color:red}", {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    const guarded = guardAssetResponse(css);

    // Same object, untouched — real assets keep their CDN immutable headers.
    expect(guarded).toBe(css);
    expect(guarded.status).toBe(200);
    expect(guarded.headers.get("Content-Type")).toContain("text/css");
    expect(guarded.headers.get("Cache-Control")).toContain("immutable");
  });

  it("passes a real JavaScript module through untouched", () => {
    const js = new Response("export const x = 1;", {
      status: 200,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });

    const guarded = guardAssetResponse(js);

    expect(guarded).toBe(js);
    expect(guarded.status).toBe(200);
    expect(guarded.headers.get("Content-Type")).toContain("javascript");
  });

  it("is case-insensitive about the HTML content-type", () => {
    const html = new Response("<html></html>", {
      status: 200,
      headers: { "Content-Type": "TEXT/HTML" },
    });

    expect(guardAssetResponse(html).status).toBe(404);
  });

  it("does not treat a missing content-type as HTML", () => {
    const opaque = new Response("binary-ish", { status: 200 });
    // jsdom/undici may default a string body to text/plain; either way it is not
    // HTML, so the guard must pass it through rather than 404 a real asset.
    const guarded = guardAssetResponse(opaque);
    expect(guarded.status).toBe(200);
  });
});
