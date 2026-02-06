# Frontend API call & URL builder inventory

This inventory captures frontend API calls and URL builders, including relative vs absolute behavior and fallback logic. It also highlights string interpolation risks where missing env values yield `"undefined/..."` URLs.

## URL builders and base URL helpers

| File | Function/Constant | URL builder behavior | Relative/Absolute | Fallback/Notes |
| --- | --- | --- | --- | --- |
| `src/config/getApiBaseUrl.ts` | `getApiBaseUrl` | Returns a hardcoded absolute API base URL (`https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net`). The unreachable code below normalizes runtime config and `VITE_API_BASE_URL`, with a warning fallback to `DEFAULT_API_BASE_URL`. | Absolute (current return path) | Hardcoded return ignores env/runtime (unreachable fallback logic). |
| `src/config/api.ts` | `API_BASE_URL`, `IS_API_BASE_CONFIGURED` | Wraps `getApiBaseUrl()` and exposes `API_BASE_URL`. | Absolute (current return path) | If `getApiBaseUrl` throws, `API_BASE_URL` is set to empty string. |
| `src/utils/apiBaseUrl.ts` | `getApiBaseUrl` | Normalizes `window.__ATLAS_RUNTIME_CONFIG__.apiBaseUrl` or `import.meta.env.VITE_API_BASE_URL`, trimming trailing slashes. | Absolute when env/runtime is absolute; empty string otherwise | Returns `""` if neither is set (no `"undefined"` risk). |
| `src/pages/Apartments.tsx` | `buildApiUrl` | Combines `baseUrl` + `path` with normalized slashes (`${normalizedBase}${normalizedPath}`). | Absolute if `baseUrl` is absolute; relative if `baseUrl` is empty string | Used with `getApiBaseUrl()` or `'mock'` sentinel. |
| `src/lib/http.ts` | `apiFetch` | If `path` is absolute, uses it as-is. Otherwise, prefixes `API_BASE_URL` (except when `IS_LOCALHOST`, where it leaves the relative path). | Depends on input (absolute or relative) | Throws if `API_BASE_URL` is missing in non-localhost; blocks localhost requests in non-localhost. |
| `src/lib/api.ts` | `request` | Builds `url = \`${API_BASE_URL ?? ""}${path}\`` for `monitoredFetch`. | Absolute if `API_BASE_URL` is absolute; relative if empty | Falls back to `mockApi` if `IS_API_BASE_CONFIGURED` is false. |

## API call sites

| File | Component/Function | URL expression | Method | Relative/Absolute | Fallback/Notes |
| --- | --- | --- | --- | --- | --- |
| `src/api/availabilityClient.ts` | `fetchAvailability` | `new URL(\`${API_BASE_URL}/availability\`)` + `searchParams` | `GET` | Absolute if `API_BASE_URL` absolute | Throws on non-OK response. |
| `src/api/listingClient.ts` | `fetchListingById` | `\`${API_BASE_URL}/listings/${listingId}\`` | `GET` | Absolute if `API_BASE_URL` absolute | Throws on non-OK response. |
| `src/components/availability/SearchAvailabilityWidget.tsx` | `performAvailabilityCheck` | `apiBaseUrl ? \`${apiBaseUrl}/availability?...\` : ''` | `GET` | Absolute if `apiBaseUrl` is absolute; otherwise no request | If `getApiBaseUrl()` returns `""`, skips fetch and shows “all homes” fallback. |
| `src/components/availability/UnitBookingWidget.tsx` | `fetchBlockedDates` | `\`${import.meta.env.VITE_API_BASE_URL}/availability/listing-availability?listingId=${listingId}&startDate=${dateStr}\`` | `GET` | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/availability/..."`. If it is an empty string, this degrades to a same-origin relative `/availability/...` URL. |
| `src/components/availability/UnitBookingWidget.tsx` | `handleSendSelectedDates` | `\`${import.meta.env.VITE_API_BASE_URL}/availability/blocks\`` | `POST` | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/availability/blocks"`. If it is an empty string, this degrades to same-origin `/availability/blocks`. |
| `src/components/availability/UnitBookingWidget.tsx` | `verifyPayment` | `\`${import.meta.env.VITE_API_BASE_URL}/api/Razorpay/verify\`` | `POST` (axios) | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/api/Razorpay/verify"`. If it is an empty string, this degrades to same-origin `/api/Razorpay/verify`. |
| `src/components/availability/UnitBookingWidget.tsx` | `handleSubmit` (order creation) | `\`${import.meta.env.VITE_API_BASE_URL}/api/Razorpay/order\`` | `POST` (axios) | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/api/Razorpay/order"`. If it is an empty string, this degrades to same-origin `/api/Razorpay/order`. |
| `src/utils/listingResolver.ts` | `resolveListing` (direct lookup) | `\`${import.meta.env.VITE_API_BASE_URL}/listings/${encodeURIComponent(param)}\`` | `GET` | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/listings/..."`. If it is an empty string, this degrades to same-origin `/listings/...`. |
| `src/utils/listingResolver.ts` | `resolveListing` (fallback list) | `\`${import.meta.env.VITE_API_BASE_URL}/listings\`` | `GET` | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_API_BASE_URL` is undefined, URL becomes `"undefined/listings"`. If it is an empty string, this degrades to same-origin `/listings`. |
| `src/utils/callbackLeads.ts` | `submitCallbackLead` | `import.meta.env.VITE_CALLBACK_LEADS_ENDPOINT || "/api/leads/callback"` | `POST` | Relative by default (`/api/leads/callback`) | Falls back to relative same-origin endpoint when env missing/empty. |
| `src/pages/contactus/ContactUs.tsx` | `handleSubmit` | `"/api/contact"` | `POST` | Relative (same-origin) | No env dependency; shows toast/errors on failure. |
| `src/components/support-drawer/AtlasChat.tsx` | `handleSend` | `\`${import.meta.env.VITE_CHAT_API_URL}/chat\`` | `POST` | **Potentially invalid** (string interpolation) | ⚠️ If `VITE_CHAT_API_URL` is undefined, URL becomes `"undefined/chat"`. |
| `src/lib/api.ts` | `request` | `\`${API_BASE_URL ?? ""}${path}\`` | Varies (default `GET`) | Absolute if `API_BASE_URL` absolute; relative if empty | If `IS_API_BASE_CONFIGURED` is false, uses `mockApi` with `mock://` URL marker. |
| `src/lib/http.ts` | `apiFetch` | `path` or `\`${API_BASE_URL}${path}\`` | Varies | Depends on input and config | Throws if `API_BASE_URL` missing in non-localhost; blocks localhost in non-localhost. |
| `src/pages/Apartments.tsx` | `fetchFromApi` | `buildApiUrl(baseUrl, path)` | `GET` | Absolute if baseUrl absolute; relative if empty | Uses `mockApi` when `baseUrl === 'mock'`. |
| `src/lib/monitoring.ts` | `sendToSentry` | `\`${protocol}//${host}${path ?? ''}/api/${projectId}/store/\`` | `POST` | Absolute | Sends only when `VITE_SENTRY_DSN` parses successfully. |
| `src/lib/monitoring.ts` | `monitoredFetch` | `url` (passed in) | Varies | Depends on caller | Wrapper around `fetch` with timeout/error logging. |
| `src/lib/email/emailService.ts` | `emailJsProvider.checkConnectivity` | `"https://api.emailjs.com/api/v1.0/ping"` | `POST` | Absolute | Used only when EmailJS is configured. |
| `src/pages/Apartments.tsx` | `fetchData` | `getApiBaseUrl()` | N/A (builder usage) | Absolute or empty string | If empty, sets mock data messaging and uses `mockApi`. |

## Notes on env interpolation risks

The following direct string interpolations can degrade to `"undefined/..."` when env variables are missing, producing broken URLs that are neither valid absolute nor relative endpoints:

- `import.meta.env.VITE_API_BASE_URL` in `UnitBookingWidget` (four endpoints) and `listingResolver` (two endpoints).
- `import.meta.env.VITE_CHAT_API_URL` in `AtlasChat` (`/chat`).

In contrast, `getApiBaseUrl()` (from `src/utils/apiBaseUrl.ts`) returns `""` when env/runtime is missing, and the calling code explicitly avoids issuing a request or falls back to mock data.
