/**
 * Atlas Guest Portal — Service Worker
 * ====================================
 * Lightweight, hand-written service worker (no Workbox dependency) that:
 *  - precaches the SPA shell (`/`) on install so an offline reload still
 *    returns rendered HTML rather than the browser's default offline page;
 *  - uses a NetworkFirst strategy for navigation requests with a cached-shell
 *    fallback when the network is unavailable;
 *  - never caches API or auth-bearing requests (`/api`, `/listings`,
 *    `/availability`, `/bookings`, `/properties`, `/pricing` — see vite proxy);
 *  - skips installation/activation gates so updates roll out without a
 *    second reload.
 *
 * Cache-key naming
 * ----------------
 * The cache name carries the tenant slug derived from the hostname so that
 * Tenant A's cached assets cannot bleed into Tenant B's namespace once the
 * portal is served from per-tenant subdomains. In dev, the slug resolves to
 * `localhost` which is harmless because both tenants share the same origin.
 */

 

const TENANT_SLUG = (() => {
  try {
    const host = self.location?.hostname || 'unknown';
    // Strip ports and pick the leftmost label as the tenant slug.
    return host.split(':')[0].split('.')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
})();

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `atlas-guest-shell-${TENANT_SLUG}-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort precache — individual failures must not block install
      // (e.g. /index.html may 404 in dev when the file is virtual).
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(url).catch(() => {
            // Ignore — we'll fall back to runtime caching on first navigation.
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any stale caches from older versions / other tenant builds
      // running on the same origin during dev.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('atlas-guest-shell-') && n !== SHELL_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Returns true if the request URL hits an API surface that must never be
 * cached. We deliberately match path prefixes (not full URLs) so the same
 * rules apply on dev (proxied through Vite) and prod (cross-origin to the
 * Azure App Service).
 */
function isApiRequest(url) {
  const apiPrefixes = ['/api/', '/listings', '/availability', '/bookings', '/properties', '/pricing', '/tenants'];
  return apiPrefixes.some((p) => url.pathname === p || url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only intercept GETs — mutations must always hit the network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Skip cross-origin requests entirely.
  if (url.origin !== self.location.origin) return;
  // Never cache API responses.
  if (isApiRequest(url)) return;

  // Navigation requests → NetworkFirst with cached-shell fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          // Clone before caching: a Response body may only be consumed once.
          // Skip caching responses that carry sensitive headers.
          if (
            fresh.ok &&
            !fresh.headers.get('authorization') &&
            !fresh.headers.get('set-cookie')
          ) {
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = (await cache.match(req)) || (await cache.match('/'));
          if (cached) return cached;
          // Last-resort offline page so the body is never empty.
          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title></head>' +
              '<body><h1>Offline</h1><p>You appear to be offline. Please reconnect and try again.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }
      })(),
    );
    return;
  }

  // Static assets → cache-first with network fallback (and skip auth-bearing responses).
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (
          fresh.ok &&
          !fresh.headers.get('authorization') &&
          !fresh.headers.get('set-cookie')
        ) {
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        // No cached copy and the network failed — propagate the error.
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      }
    })(),
  );
});
