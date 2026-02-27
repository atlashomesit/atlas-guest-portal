# Runtime-config cleanup audit report

## ✅ Confirmed runtime config entrypoint

- Entrypoint: `src/main.tsx` in `bootstrapApp()`.
- Runtime loading path: `loadRuntimeConfig()` then `setRuntimeConfig(config)` before `<App />` is rendered.
- Failure behavior: any load/validation failure renders `ConfigErrorScreen` and prevents normal app boot.

## ✅ Confirmed single source of truth

- `apiBaseUrl`: `src/runtime-config/index.ts#getApiBaseUrl()`.
- `globalDiscountPercent`: `src/runtime-config/index.ts#getGlobalDiscountPercent()`.
  - Default `0` is centralized only here (`globalDiscountPercent ?? 0`).

## 🔍 Removed legacy patterns

1. **Legacy safe API fallback wrapper removed**
   - Deleted: `src/config/api.ts`
   - Old behavior: `getApiBaseUrlSafe()` swallowed runtime-config errors and returned empty string.

2. **Legacy duplicate API wrapper test removed**
   - Deleted: `src/config/getApiBaseUrl.test.ts`
   - Old coverage was for compatibility wrapper behavior rather than strict runtime-config behavior.

3. **Legacy env helper indirection removed**
   - Deleted: `src/utils/env.ts`
   - Old behavior: `getApiBase()` proxied to safe wrapper and encouraged hidden fallbacks.

4. **Legacy API-config dependency removed from booking UI**
   - Updated: `src/components/availability/UnitBookingWidget.tsx`
   - Updated: `src/components/homepage_components/hotelBooking_form/BookingCardPricingPaymentSection.tsx`
   - Old behavior: `isApiBaseConfigured()` checked a fallback-safe wrapper.
   - New behavior: `hasRuntimeConfig()` is used directly.

5. **Noisy debug logging reduced in listing resolution**
   - Updated: `src/utils/listingResolver.ts`
   - Removed dev-only console logging around request/404 fallback paths.

## 🧹 Remaining issues + recommended follow-ups

1. Frontend still uses several non-runtime `VITE_*` keys for non-API concerns (analytics, EmailJS, chat, callback leads, pricing multipliers); these are outside API-base runtime config scope and should be reviewed separately.
2. `src/lib/env.ts` remains as a compatibility re-export for auth/env helpers; consider replacing with direct imports from `src/config/env.ts` in a future pass.
3. `src/components/ApiConfigGuard.tsx` is currently pass-through and can be removed once import churn is acceptable.
4. Some historical docs under `docs/debug/*` still mention build-time `VITE_API_BASE_URL` behavior and may confuse future maintenance; archive or label as historical.
