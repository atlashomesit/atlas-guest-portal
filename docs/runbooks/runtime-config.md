# Runtime configuration runbook (post-build)

## Why runtime config

Atlas Homestays deploys one frontend artifact across environments/tenants. Runtime config is required so each domain can provide its own API settings without rebuilding.

- Build once, configure per environment/tenant.
- No reliance on build-time `VITE_API_BASE_URL` / `VITE_GLOBAL_DISCOUNT_PERCENT`.
- No hostname-to-API mapping embedded in the frontend bundle.

## Runtime config endpoint path

The app fetches runtime config from:

- `/.well-known/atlas-runtime-config.json`

Required shape:

| Field | Required | Validation |
|---|---|---|
| `apiBaseUrl` | Yes | Valid absolute `http`/`https` URL |
| `globalDiscountPercent` | No | Number in `0..100` (defaults to `0` in centralized getter) |
| `tenantKey` | No | Tenant slug for `X-Tenant-Slug` header (e.g. `atlas`). Set for dev/staging so API can resolve tenant when host is e.g. `dev.atlashomestays.com`. |

Example:

```json
{
  "apiBaseUrl": "https://api.example.com",
  "globalDiscountPercent": 20,
  "environment": "production",
  "tenantKey": "atlas"
}
```

## Local development

A committed local file exists at `public/.well-known/atlas-runtime-config.json` for local testing (`localhost` workflow).

Production should not depend on this committed default. Serve runtime config dynamically per deployed domain (e.g. via Cloudflare Pages Function at `functions/.well-known/atlas-runtime-config.json.ts`).

## How dev/prod domains get different configs

Each domain must serve its own runtime JSON from the same endpoint path:

- `https://dev.example.com/.well-known/atlas-runtime-config.json` → dev API values
- `https://app.example.com/.well-known/atlas-runtime-config.json` → prod API values

The frontend bundle stays identical; only the served JSON changes.

## How to verify in browser

1. Open DevTools → **Network**.
2. Reload the page.
3. Confirm request to `/.well-known/atlas-runtime-config.json` returns `200` with valid JSON.
4. Confirm API requests target the `apiBaseUrl` origin from that JSON.
5. If runtime config fails, confirm the app shows the runtime-config error screen (no silent fallback requests).

## Troubleshooting checklist

- Is `/.well-known/atlas-runtime-config.json` reachable for this exact domain?
- Is response JSON valid?
- Is `apiBaseUrl` present and valid absolute `http/https` URL?
- If provided, is `globalDiscountPercent` within `0..100`?
- In localhost development, does `apiBaseUrl` point to localhost?
- Are CDN/browser caches bypassed (`Cache-Control: no-store` recommended)?
- Do subsequent API calls use the same origin as configured `apiBaseUrl`?
- If the API returns `400` with `"Tenant could not be resolved."`, set `tenantKey` (e.g. `atlas`) in the runtime config for this domain (e.g. in Cloudflare Pages set `ATLAS_TENANT_KEY=atlas` for Preview).
