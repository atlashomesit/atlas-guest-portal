# Guest Portal ↔ Atlas API Alignment

## Step 1 — Integration points (no code changes)

### API base and URL building
- **`src/api/client.ts`**: `buildApiUrl(path)` uses `getApiBaseUrl()` from runtime-config; no interceptors; no tenant header.
- **`src/runtime-config/index.ts`**: Exports `getApiBaseUrl()`, `getRuntimeConfig()`; config has optional `tenantKey` (not sent to API).
- **`src/lib/http.ts`**: `apiFetch(path, init)` uses `getApiBaseUrl()` for non-absolute paths; no `X-Tenant-Slug`; when `IS_LOCALHOST` the `path` is used as-is (can be full URL).

### Tenant
- **Contract**: Tenant resolution uses **X-Tenant-Slug** header; fallback subdomain (e.g. `contoso.atlashomestays.com` → `contoso`); default `atlas` only in dev/local. No tenant picker in guest UI.
- **Current**: `tenantKey` exists in runtime config but is never sent. No tenant selection UI found.

### Listings
- **`src/api/listingClient.ts`**: `fetchListingById(listingId)` → `GET buildApiUrl('/listings/' + listingId)`.
- **`src/utils/listingResolver.ts`**: Uses `getApiBaseUrl()`; fetches `GET {base}/listings/{param}` for direct lookup, then `GET {base}/listings` and finds by name/slug. Does **not** use `buildApiUrl` (inconsistent base).

### Availability
- **`src/api/availabilityClient.ts`**: `fetchAvailability({ propertyId, checkIn, checkOut, guests })` → `GET buildApiUrl('/availability')` + query params. Uses raw `fetch` (no tenant header).
- **`src/components/availability/UnitBookingWidget.tsx`**: Calendar availability via `buildApiUrl('/availability/listing-availability')` + `listingId`, `startDate`, `endDate`; then `apiFetch(availabilityKey)` (full URL). Response parsed as `data.dates` or `data.availability` or `data.Availability`.
- **`src/components/availability/SearchAvailabilityWidget.tsx`**: Hero form builds `getApiBaseUrl() + '/availability?checkIn=...&checkOut=...&guests=...'` (no `propertyId`); uses raw `fetch(availabilityUrl)`.

### Pricing
- **UnitBookingWidget**: Uses client-side `calculateNightlyPrice()` and `finalTotal`; no call to `GET /pricing/breakdown`.

### Quote
- Not used in guest portal (no POST /quotes or GET /quotes/validate).

### Razorpay
- **UnitBookingWidget**: 
  - Order: `axios.post(buildApiUrl('/api/Razorpay/order'), orderPayload)` with `bookingDraft`, `amount`, `currency`, `guestInfo`. No tenant header on axios.
  - Verify: `axios.post(buildApiUrl('/api/Razorpay/verify'), { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature })`.

### Booking confirmation
- Success path sets `bookingDetails` from order response (`bookingId`, amount, etc.); no subsequent `GET /bookings/by-reference` or `GET /bookings/{id}` to show server-confirmed booking.

### Files to touch for alignment
- API client / tenant: `src/api/client.ts`, `src/lib/http.ts`, new `src/tenant/TenantResolver.ts` (or `src/api/tenantResolver.ts`).
- Listings: `src/api/listingClient.ts`, `src/utils/listingResolver.ts` (use public endpoint + buildApiUrl).
- Availability: `availabilityClient.ts`, `UnitBookingWidget.tsx` (listing-availability: use `months` if contract requires), `SearchAvailabilityWidget.tsx` (hero: avoid /availability when no propertyId, or document limitation).
- Pricing: optional `src/api/pricingClient.ts`, UnitBookingWidget to use GET /pricing/breakdown for display and rely on server amount for order.
- Razorpay: ensure request DTOs match (bookingDraft.CheckinDate/CheckoutDate, GuestInfo); add tenant header via shared client.
- Confirmation: add fetch by `externalReservationId` (GET /bookings/by-reference) when available.

---

## Step 2 — API alignment checklist

| # | Operation | Current (RatebotaiRepo) | Contract (api-contract.md) | Action |
|---|-----------|-------------------------|----------------------------|--------|
| 1 | Listings list | GET /listings (listingResolver, listingClient) | GET /listings/public returns PublicListingDto (safe) | Use GET /listings/public for discovery; keep GET /listings/{id} for single or use public if API supports by-id from public. |
| 2 | Listing by id | GET /listings/{id} | GET /listings/{id} or public | Keep; ensure tenant header so tenant-scoped 404 is correct. |
| 3 | Availability (property) | GET /availability?propertyId, checkIn, checkOut, guests | Same | Align; ensure response shape (listings/nightlyRates) matches AvailabilityResponseDto. |
| 4 | Availability (listing calendar) | GET /availability/listing-availability?listingId, startDate, **endDate** | listingId, startDate, **months** (optional, default 2, 1–12) | Send **months** instead of endDate (e.g. months=2 for ~2 months). |
| 5 | Hero availability | GET /availability?checkIn, checkOut, guests (no propertyId) | propertyId **required** | Do not call /availability without propertyId; hero can skip API call and just navigate to search, or omit availability check. |
| 6 | Pricing breakdown | Client-side only | GET /pricing/breakdown?listingId, checkIn, checkOut | Add optional call for display; order amount is server-computed from draft/quote. |
| 7 | Quote | Not used | POST /quotes, GET /quotes/validate | Optional later; not required for minimal alignment. |
| 8 | Razorpay order | POST /api/Razorpay/order { bookingDraft, amount, currency, guestInfo } | BookingDraft + Currency + GuestInfo; server computes amount; Amount deprecated | Keep payload; ensure bookingDraft uses CheckinDate/CheckoutDate (API accepts camelCase). Add X-Tenant-Slug. |
| 9 | Razorpay verify | POST /api/Razorpay/verify { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } | BookingId, RazorpayOrderId, RazorpayPaymentId, RazorpaySignature | Match; ASP.NET binds camelCase. Add X-Tenant-Slug. |
| 10 | Booking confirmation | Not fetched | GET /bookings/by-reference?externalReservationId= | After payment success, fetch confirmation via by-reference when externalReservationId is returned, or by booking id. |
| 11 | Tenant | Not sent | X-Tenant-Slug header (or subdomain) | Implement TenantResolver (hostname → slug); attach X-Tenant-Slug on all API requests. |

### DTO notes
- **BookingDraftDto**: ListingId (int), CheckinDate, CheckoutDate (DateTime), Guests (int), Notes (optional). Client sends camelCase; API accepts both.
- **VerifyRazorpayPaymentRequest**: BookingId (int), RazorpayOrderId, RazorpayPaymentId, RazorpaySignature (strings). Same.
- **ListingAvailabilityResponseDto**: Contract says response type; widget currently parses `dates` / `availability` / `Availability` — normalize to contract shape if API returns different keys.

---

## Deliverables (implementation summary)

### Files changed
- **New**: `src/tenant/tenantResolver.ts` — hostname → tenant slug; `src/tenant/tenantResolver.test.ts` — unit tests; `src/api/pricingClient.ts` — GET /pricing/breakdown; `src/api/bookingClient.ts` — GET /bookings/by-reference; `docs/guest-portal-api-alignment.md` — Step 1 & 2 + checklist.
- **Modified**: `src/api/client.ts` — added `getApiHeaders()` (X-Tenant-Slug from TenantResolver + runtime config fallback); `src/lib/http.ts` — merge tenant headers into `apiFetch`; `src/api/availabilityClient.ts` — pass `getApiHeaders()` to fetch; `src/api/listingClient.ts` — pass `getApiHeaders()` to fetch; `src/utils/listingResolver.ts` — use `buildApiUrl`, `getApiHeaders`, and GET `/listings/public` for list; `src/components/availability/UnitBookingWidget.tsx` — listing-availability uses `months=2`, Razorpay order/verify use `getApiHeaders()`, error messages via `getBookingErrorMessage()`; `src/components/availability/SearchAvailabilityWidget.tsx` — hero does not call GET /availability when no propertyId; `src/utils/__tests__/listingResolver.test.ts` — runtime config, `/listings/public`, and network-error test.

### Endpoints updated (before → after)
| Operation | Before | After |
|------------|--------|--------|
| Listings list | GET /listings | GET /listings/public |
| Listing by id | GET /listings/{id} | GET /listings/{id} (unchanged; headers added) |
| Listing calendar availability | GET .../listing-availability?listingId, startDate, **endDate** | ...?listingId, startDate, **months=2** |
| Hero availability | GET /availability?checkIn, checkOut, guests (no propertyId) | No call (navigate to search only) |
| Razorpay order/verify | No tenant header | Header **X-Tenant-Slug** via getApiHeaders() |
| All API requests | No tenant header | **X-Tenant-Slug** when slug resolved (see below) |

### Tenant inference (dev/prod)
- **Production**: `atlashomestays.com` → slug `atlas`; `<tenant>.atlashomestays.com` → slug `<tenant>`. Resolved in `getTenantSlugFromHostname()` and sent as `X-Tenant-Slug` on all requests via `getApiHeaders()` (used in `apiFetch`, axios in UnitBookingWidget, availabilityClient, listingClient, listingResolver).
- **Localhost / dev**: Hostname does not resolve to a slug; `getTenantSlug()` uses **fallback** from runtime config `tenantKey` (e.g. in `/.well-known/atlas-runtime-config.json`). No tenant picker in UI.

### Test commands and results
- `npx vitest run --config vitest.config.ts src/tenant/tenantResolver.test.ts src/utils/__tests__/listingResolver.test.ts src/lib/http.test.ts src/runtime-config/loader.test.ts src/runtime-config/index.test.ts` — **35 tests passed**.
- `npm run lint` — **passed**.
- `npm run build` — **passed** (prebuild legal validation + vite build).
- Full `npm run test` — some existing tests fail (runtime config not loaded, timers, integration selectors); **no new failures** from these changes.
