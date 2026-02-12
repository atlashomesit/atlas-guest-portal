# Runtime configuration (post-build)

## Why runtime config

Atlas Homestays is deployed as a single frontend build across environments/tenants. Runtime config keeps deployment flexible:

- Build once, configure per environment/tenant.
- No reliance on build-time `VITE_API_BASE_URL` / `VITE_GLOBAL_DISCOUNT_PERCENT` injection.
- Config changes do not require rebuilding the frontend bundle.

## Runtime config endpoint

The app loads config at startup from exactly:

- `/.well-known/atlas-runtime-config.json`

Required fields:

| Field | Required | Validation |
|---|---|---|
| `apiBaseUrl` | Yes | Must be a valid `http`/`https` URL |
| `globalDiscountPercent` | No | Number `0..100`; defaults to `0` in code |

Example:

```json
{
  "apiBaseUrl": "https://api.example.com",
  "globalDiscountPercent": 20,
  "environment": "production"
}
```

## Local development

A committed local default exists at `public/.well-known/atlas-runtime-config.json`.

- This file is for local/dev convenience.
- Production/preview must serve environment-specific JSON at the same path.
- Do not rely on the committed local file as a production default.

## How dev/prod domains get different config

Each domain serves its own `/.well-known/atlas-runtime-config.json`:

- `https://dev.example.com/.well-known/atlas-runtime-config.json` → dev API URL
- `https://app.example.com/.well-known/atlas-runtime-config.json` → prod API URL

The same frontend build can be deployed to both domains; domain-specific JSON supplies the runtime values.

## Browser verification

1. Open DevTools → Network.
2. Refresh the app.
3. Confirm a request to `/.well-known/atlas-runtime-config.json` returns `200` with valid JSON.
4. Confirm API requests target the configured `apiBaseUrl` origin.

## Failure behavior

If runtime config is missing or invalid:

- app startup fails loudly,
- the error screen is rendered,
- there is no silent fallback to hardcoded or same-origin API URLs.

## Troubleshooting checklist

- Is `/.well-known/atlas-runtime-config.json` reachable on the current domain?
- Is the JSON valid?
- Is `apiBaseUrl` present and a valid absolute `http/https` URL?
- If provided, is `globalDiscountPercent` within `0..100`?
- In localhost dev, does `apiBaseUrl` point to localhost?
- Are stale CDN/browser caches bypassed for the config response?
- Are downstream API calls going to the same origin as `apiBaseUrl`?
