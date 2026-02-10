# Local network permission prompt investigation (dev.atlashomestays.com)

## Summary
Chrome’s “Local network device access” prompt is most likely triggered by the guest portal attempting to fetch API data from a **private network host** supplied via runtime configuration. The request happens on initial page load (no user action) from the Apartments page data bootstrap, which means Chrome’s Private Network Access (PNA) guard can prompt immediately.

### Most likely trigger
- **Triggering code path:** `src/pages/Apartments.tsx` → `fetchData()` → `fetchFromApi()` → `monitoredFetch(url, ...)`.
- **Configuration source:** `/config` Cloudflare Pages Function injects `window.__ATLAS_RUNTIME_CONFIG__.apiBaseUrl`.
- **Root cause:** When `apiBaseUrl` is a private IP/host (for example, `10.x`, `192.168.x`, `.local`, etc.) on a production-like domain, Chrome treats it as a private network access attempt and displays the prompt.

## Reproduction + evidence
### Attempted runtime config fetch (dev)
- Requesting `https://dev.atlashomestays.com/config` and `/config.js` returns **403** in this environment (unable to confirm actual runtime API base URL value).

### Local build
- A local build was not started in this environment, so DevTools capture for `localhost` is not available.

> **Note:** Because DevTools access is not available in this environment, the investigation relied on static and configuration audits plus best-effort network checks. The fix below eliminates the private network path regardless of the runtime value, preventing future prompts.

## Static code audit (repo-wide)
### Keyword scan (WebRTC / device APIs / local network)
- No usage found for WebRTC/device APIs (`RTCPeerConnection`, `getUserMedia`, `navigator.bluetooth`, etc.) in application sources.
- The only local-network-related string usage is in configuration and documentation warnings (e.g., localhost checks).

### Suspicious request paths
- **`src/pages/Apartments.tsx`**: `fetchData()` reads `getApiBaseUrl()` and triggers data fetches on initial page load. If `apiBaseUrl` resolves to a private host, the initial GETs to `/listings` and `/properties` will hit the private network.
- **`functions/config.js`**: Injects `window.__ATLAS_RUNTIME_CONFIG__ = { apiBaseUrl: ... }` with no validation; any private host set in Cloudflare Pages env will propagate directly into the client.

### Config and runtime guard findings
- **`src/config/getApiBaseUrl.ts`**: Previously blocked only `localhost` in production-like environments; private IP ranges and `.local` were not blocked.
- **`src/utils/apiBaseUrl.ts`**: Read runtime config without any production guard, so guest pages could access a private host even when the stricter config guard would have blocked `API_BASE_URL` elsewhere.

## Dependency audit
- No dependencies suggest automatic device discovery or local network probing (no WebRTC, casting, or Bluetooth/USB SDKs). Current dependencies are UI/UX + standard web libraries (React, Swiper, EmailJS, etc.).

## Root cause conclusion
**The prompt is likely caused by production traffic on `dev.atlashomestays.com` trying to fetch from a private network API host** configured via runtime `/config`, which is triggered immediately on page load by the Apartments data bootstrap.

## Fix summary (implemented)
1. **Added private-network guard** to `getApiBaseUrl` to reject localhost, `.local`, and private IP ranges in production-like environments.
2. **Aligned `src/utils/apiBaseUrl.ts`** with the stricter config guard to avoid bypassing the protection.
3. **Added bundle scan** to CI to prevent local network APIs/URLs from entering the production bundle.
4. **Updated README** with security notes to avoid reintroducing this class of issue.

## Follow-up (optional)
- Verify the Cloudflare Pages `VITE_API_BASE_URL` for dev/preview/prod scopes and ensure each points to a publicly routable HTTPS API host.
- If `/config` remains 403, confirm Pages Function routing and access policies to ensure the runtime config can be loaded by the SPA.
