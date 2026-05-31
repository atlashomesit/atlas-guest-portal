import { guardAssetResponse } from "../_lib/assetGuard";

/**
 * Pages Function middleware over /assets/* — Vite's immutable, content-hashed
 * build output (the only files served from that prefix).
 *
 * It lets Cloudflare serve the real static asset via `next()` (so existing
 * assets keep their `immutable` caching untouched), then runs `guardAssetResponse`
 * to rewrite the SPA-fallback HTML that Cloudflare returns for a *missing* hashed
 * file into an explicitly-uncacheable 404. This stops the "Refused to apply style
 * (MIME text/html)" cache-poisoning bug that broke CSS/JS in real browsers after
 * every deploy. See `functions/_lib/assetGuard.ts` for the full rationale. (TASK-2748)
 *
 * Typed inline (matching the other functions in this repo) to avoid a build-time
 * dependency on @cloudflare/workers-types.
 */
export const onRequest = async (context: {
  next: () => Promise<Response>;
}): Promise<Response> => {
  let response: Response;
  try {
    response = await context.next();
  } catch {
    // Fail closed for asset requests: never serve a fallback document body, and
    // never cache the error. A transient miss self-heals on the next request.
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Atlas-Asset-Guard": "next-threw-404",
      },
    });
  }
  return guardAssetResponse(response);
};
