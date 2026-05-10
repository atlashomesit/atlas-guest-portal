/**
 * Service worker registration shim for the Atlas guest portal.
 * Loaded as a deferred script from index.html so it does not block first paint.
 *
 * Kept in `public/` (rather than `src/`) so it is served verbatim by Vite in
 * dev and copied to the build output without bundling — this avoids the need
 * for a `'unsafe-inline'` CSP exemption and keeps the registration path
 * identical between dev and prod.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // Register as soon as the page is idle so we do not contend with first paint.
  var register = function () {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(function (err) {
        // Failure is non-fatal — the app still works without a SW.
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[PWA] service worker registration failed:', err);
        }
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
})();
