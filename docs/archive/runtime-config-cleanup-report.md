# Runtime-config cleanup audit report

**Archived:** Moved to docs/archive/ as part of Documentation IA Phase 2. Historical reference only.

---

## ✅ Confirmed runtime config entrypoint

- Entrypoint: `src/main.tsx` in `bootstrapApp()`.
- Runtime loading path: `loadRuntimeConfig()` then `setRuntimeConfig(config)` before `<App />` is rendered.
- Failure behavior: any load/validation failure renders `ConfigErrorScreen` and prevents normal app boot.

## ✅ Confirmed single source of truth

- `apiBaseUrl`: `src/runtime-config/index.ts#getApiBaseUrl()`.
- `globalDiscountPercent`: `src/runtime-config/index.ts#getGlobalDiscountPercent()`.

## 🔍 Removed legacy patterns

(Original audit content preserved — see git history for full report.)

---

For current runtime config behavior, see docs/runbooks/runtime-config.md and docs/runbooks/cloudflare-pages-env-vars.md.
