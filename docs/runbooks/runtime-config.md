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

The repo includes a **default config file** at `public/.well-known/atlas-runtime-config.json` with values safe for **local development only** (e.g. `apiBaseUrl: "http://localhost:5000"`, `globalDiscountPercent: 0`). Vite copies `public/` into `dist/`, so the file is served at `/.well-known/atlas-runtime-config.json` when no Function overrides it.

### Cloudflare Pages (recommended): Pages Function

A **Pages Function** at `functions/.well-known/atlas-runtime-config.json.ts` serves `/.well-known/atlas-runtime-config.json` from environment variables. When present, it overrides the static file so dev/staging/production get the correct config.

**Set these in Cloudflare Pages → your project → Settings → Environment variables** (for Production and/or Preview as needed):

| Variable | Required | Description |
|----------|----------|-------------|
| `ATLAS_API_BASE_URL` | **Yes** | API base URL for this environment (e.g. `https://atlas-homes-api-dev.azurewebsites.net` for dev, or your production API URL). |
| `ATLAS_GLOBAL_DISCOUNT_PERCENT` | No | Number 0–100. Default: 0. |
| `ATLAS_ENVIRONMENT` | No | String (e.g. `dev`, `production`) for logging. |
| `ATLAS_GOOGLE_MAPS_API_KEY` | No | Google Maps API key if you use dynamic maps. |

After setting variables, trigger a **new deployment** (e.g. push a commit or use “Retry deployment”). The Function runs at request time, so no rebuild is needed for config-only changes once the Function is deployed.

If `ATLAS_API_BASE_URL` is not set, the Function returns HTTP 500 and the app will show “Runtime config missing/invalid”.

### Other hosts

- **Manual:** Replace the file on the host after deploy (e.g. overwrite `dist/.well-known/atlas-runtime-config.json` in a build step or upload the correct JSON).
- **CI:** Generate the JSON from secrets in CI and write it into the build output before deploy.

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
