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

  // G3 journey 16: opened with no connection and the app's scripts not in the cache, the page used to sit on the grey loading shapes
  // for ever with no word on it. If the loading shell is still there after 4 seconds and the browser says it is offline, say so in plain
  // words, and load again by itself when the connection comes back.
  var OFFLINE_NOTICE_ID = 'boot-offline-notice';
  var showOfflineNotice = function () {
    if (navigator.onLine !== false) return;
    if (!document.querySelector('[data-testid="boot-shell"]')) return;
    if (document.getElementById(OFFLINE_NOTICE_ID)) return;
    var p = document.createElement('p');
    p.id = OFFLINE_NOTICE_ID;
    p.setAttribute('role', 'alert');
    p.style.cssText = 'position:fixed;left:16px;right:16px;bottom:24px;margin:0 auto;max-width:420px;padding:14px 16px;border-radius:12px;background:#fff;color:#3b2a24;font:16px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647';
    p.textContent = "You're offline. This page will open when your connection is back.";
    document.body.appendChild(p);
    window.addEventListener('online', function () { window.location.reload(); }, { once: true });
  };
  window.setTimeout(showOfflineNotice, 4000);
  window.addEventListener('offline', function () { window.setTimeout(showOfflineNotice, 4000); });

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
