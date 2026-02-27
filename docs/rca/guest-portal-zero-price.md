# RCA: ₹0 pricing on listing detail pages

## Problem
On listing pages (e.g. `/homes/atlas-homes-room-102/2`, `/homes/atlas-homes-room-301/5`), the Reserve widget shows "₹0" for "Best price on our website" even though network calls to `breakdown` and `listing-availability` succeed.

## Root cause

### API side
`GET /pricing/daily-summary` returns today's pricing for all listings. The `AdminPricingService.GetCalendarPricingViewAsync` computes `BaseAmount` per listing:

```csharp
var baseRate = pricing?.BaseNightlyRate ?? 0;  // Line 80
```

When a listing has **no row in `ListingPricings`** (e.g. not configured yet), `pricing` is null → `baseRate = 0`. The API then returns `BaseAmount=0`, `DiscountAmount=0`, `FinalAmount=0` for that listing. **The API silently returns 0** instead of failing or omitting the listing.

### Frontend side
- `useDailyPricingSummary` fetches daily-summary and builds a map keyed by `listingId`.
- `getTodayBreakdownFromListing` computes `actualPrice = baseAmount - discountAmount`. When API returns 0, `actualPrice = 0`.
- `UnitBookingWidget` displays `dailyPricing.actualPrice` when `dailyPricing` exists. **No check for `actualPrice > 0`** → UI shows ₹0.

### Data flow
1. daily-summary → listing with BaseAmount=0
2. getTodayBreakdownFromListing → actualPrice=0
3. UI branch `dailyPricing && ...` → format(0) → ₹0

## Why it wasn't caught locally/tests

1. **Local dev**: If `ListingPricings` is seeded for all listings in dev DB, API returns valid prices. The 0-case only appears when listings lack pricing rows (e.g. new listing, prod data gap).
2. **Mocks**: Unit tests mock `useDailyPricingSummary` or `getListingPricing` with positive values. No "trap" fixture with actualPrice=0.
3. **No prod-like preview**: Smoke tests didn't assert that displayed price is never ₹0.
4. **API tests**: Integration tests may use seeded data with pricing; no assertion that daily-summary never returns 0 for valid listings.

## Fix (summary)

1. **Frontend**: Introduce `effectiveDailyPricing` — treat `dailyPricing.actualPrice <= 0` as invalid and use client-side `priceDetails` fallback. Add `displayPrice(n)` helper that shows "Price unavailable" when n ≤ 0. Never render ₹0.
2. **API**: Integration test asserts daily-summary returns positive FinalAmount when listing has ListingPricing.
3. **Smoke**: `npm run smoke:preview` fails if page HTML contains "₹0" and "Best price" (best-effort for client-rendered content).
