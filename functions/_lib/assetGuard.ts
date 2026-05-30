/**
 * Asset-integrity guard for /assets/* (TASK-2748).
 *
 * Cloudflare Pages serves the SPA fallback (index.html — 200, `text/html`) for
 * any path that has no matching static asset. That includes a hashed
 * `/assets/index-*.css` (or `.js`) that is momentarily un-propagated to an edge
 * right after a deploy, or that a stale, still-cached index.html references
 * after a newer deploy removed the chunk. Because the `/assets/* immutable`
 * rule in `public/_headers` is matched by *request path* (not by what is
 * actually served), that HTML response is stamped
 * `Cache-Control: public, max-age=31536000, immutable` and cached — by the
 * browser AND the CDN edge — under a `.css`/`.js` URL for up to a year. Every
 * subsequent load then fails with:
 *
 *   Refused to apply style from '…/assets/index-*.css' because its MIME type
 *   ('text/html') is not a supported stylesheet MIME type …
 *
 * → unstyled page. It only reproduces in a real browser (a SW/`<link>` applies
 * the bytes); curl just sees a 200 and never trips. `_redirects` cannot express
 * "404 this path" (Cloudflare Pages only supports 200 rewrites + 3xx redirects),
 * and `_headers` cannot condition on response status — so a Pages Function is
 * the only mechanism that can keep immutable caching for real assets while
 * refusing to serve (and cache) HTML under an asset URL.
 *
 * This guard inspects a response already produced for an `/assets/*` request and
 * converts any `text/html` body into an honest, explicitly-uncacheable 404 so
 * the miss self-heals the instant the real asset propagates and never poisons a
 * cache. Real assets (text/css, application/javascript, fonts, images, source
 * maps, …) are returned untouched, so they keep their `immutable` headers and
 * stay edge-cacheable.
 */
export function guardAssetResponse(response: Response): Response {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  // Nothing under /assets/* is ever legitimately HTML. An HTML body here is the
  // SPA fallback for a missing hashed file — never cache or serve it as the asset.
  if (contentType.includes("text/html")) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Must NOT inherit the /assets/* immutable rule — a cached 404 would
        // outlive the propagation window and keep the asset broken.
        "Cache-Control": "no-store",
        "X-Atlas-Asset-Guard": "missing-asset-404",
      },
    });
  }

  return response;
}
