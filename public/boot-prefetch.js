/**
 * TASK-10299465 (b): start the two requests the app always makes first, while its scripts are still downloading.
 *
 * Measured with Lighthouse mobile on a production build: the app asked for its runtime config only after the entry chunk and the 235 KB
 * vendor chunk had been downloaded and run, then asked for the tenant lookup (/tenants/from-domain) only after the config answered. That is
 * two round trips stacked behind the whole script download. This file is tiny, loaded `async` in <head> (never blocks the first paint), and
 * starts both fetches at once; the app then TAKES those responses instead of asking again (src/boot/earlyFetch.ts).
 *
 * Kept in `public/` so it is served verbatim, with no `'unsafe-inline'` CSP exemption (same reason as sw-register.js). It is added to the
 * HTML by the production build only (vite.config.ts), so `vite dev` is unchanged.
 *
 * The two URLs MUST be built exactly as the app builds them:
 *   config : window.location.origin + "/.well-known/atlas-runtime-config.json", fetched with cache "no-store" (src/runtime-config/loader.ts)
 *   tenant : <apiBaseUrl without a trailing slash>/tenants/from-domain?domain=<host without port or "www.">  (src/tenant/tenantContext.ts)
 * If anything differs, or this file never runs, the app simply asks for itself as before. Nothing here can fail the page: every step is
 * wrapped, a failed prefetch is retried by the app's own request, and a response is used at most once.
 */
(function () {
  try {
    var w = window;
    if (w.__atlasEarlyFetch) return;
    // The native app has no /.well-known (it bakes its config at build time): nothing to prefetch there.
    if (w.Capacitor && typeof w.Capacitor.isNativePlatform === "function" && w.Capacitor.isNativePlatform()) return;
    if (typeof w.fetch !== "function" || !w.location || !/^https?:$/.test(w.location.protocol)) return;

    var early = (w.__atlasEarlyFetch = {});
    var configUrl = w.location.origin + "/.well-known/atlas-runtime-config.json";
    var configPromise = w.fetch(configUrl, { cache: "no-store" });
    early[configUrl] = configPromise;

    configPromise
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.clone().json();
      })
      .then(function (cfg) {
        var base = cfg && typeof cfg.apiBaseUrl === "string" ? cfg.apiBaseUrl.trim() : "";
        if (!/^https?:\/\//i.test(base)) return;
        if (base.charAt(base.length - 1) === "/") base = base.slice(0, -1);
        var host = String(w.location.hostname || "").split(":")[0].trim().toLowerCase();
        if (host.indexOf("www.") === 0) host = host.slice(4);
        if (!host) return;
        var tenantUrl = base + "/tenants/from-domain?domain=" + encodeURIComponent(host);
        early[tenantUrl] = w.fetch(tenantUrl);
        // A prefetch nobody takes must not surface as an unhandled rejection.
        early[tenantUrl].catch(function () {});
      })
      .catch(function () {});
    configPromise.catch(function () {});
  } catch (e) {
    /* never block or break the page */
  }
})();
