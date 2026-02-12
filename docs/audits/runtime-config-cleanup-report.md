# Runtime-config cleanup audit report

## ✅ Confirmed runtime config entrypoint

- Entrypoint: `src/main.tsx` → `bootstrapApp()`.
- Runtime load flow: `loadRuntimeConfig()` → `setRuntimeConfig(config)` before rendering `<App />`.
- Failure mode: any load/validation error renders `ConfigErrorScreen` and blocks app boot.

## ✅ Confirmed single source of truth

- `apiBaseUrl`: `src/runtime-config/index.ts#getApiBaseUrl()`.
- `globalDiscountPercent`: `src/runtime-config/index.ts#getGlobalDiscountPercent()`.
  - Default to `0` is centralized in this getter (`globalDiscountPercent ?? 0`).

## 🔍 Removed legacy patterns

1. **Legacy env-based API helper removed**
   - Deleted: `src/config/apiBaseUrl.ts`.
   - Old pattern: `import.meta.env.VITE_API_BASE_URL` in frontend app code.

2. **Legacy wrapper resolver removed**
   - Deleted: `src/utils/apiBaseUrl.ts`.
   - Old pattern: indirection around API base URL helper, used by pages/widgets.

3. **Dual endpoint runtime-config fetch removed**
   - Updated: `src/runtime-config/loader.ts`.
   - Old pattern: preferred `/.well-known/atlas-runtime-config.json` with hidden fallback to `/config.json`.
   - New behavior: only `/.well-known/atlas-runtime-config.json` is used.

4. **Hidden same-origin retry removed from listing resolver**
   - Updated: `src/utils/listingResolver.ts`.
   - Old pattern: on primary failure, retried with empty base URL (same-origin fallback).

5. **Mock/silent API fallback removed from runtime fetch clients**
   - Updated: `src/lib/api.ts`, `src/lib/http.ts`, `src/pages/Apartments.tsx`.
   - Old patterns:
     - fallback to `mockApi` when API base was absent,
     - same-origin fallback requests when base URL was absent,
     - local mock mode using `'mock'` base selector.

## 🧹 Remaining issues + recommended follow-ups

1. `src/config/api.ts` still provides `getApiBaseUrlSafe()`/`isApiBaseConfigured()` compatibility wrappers; consider converging all imports to `@/runtime-config` directly.
2. `src/lib/mockApi.ts` is still present for explicit mock/testing workflows; document when it is allowed in production code paths.
3. Several docs under `docs/debug/*` and older ops notes still reference `VITE_API_BASE_URL`; keep for historical context or archive to avoid confusion.
4. `ApiConfigGuard` is now pass-through and can be removed in a future cleanup once imports are updated.
