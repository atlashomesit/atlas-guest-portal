# Runtime configuration (post-build)

## Why runtime config

The app uses **runtime configuration** (loaded after the build) for API base URL, discount percentage, and optional Google Maps key. Benefits:

- **Build once, configure per environment:** The same build artifact can be deployed to dev, staging, and production; only the config file changes.
- **No rebuild for config changes:** Updating the discount or API URL does not require a new build or redeploy of the app bundle.
- **Multi-tenant SaaS readiness:** The config shape includes an optional `tenantKey` for future per-tenant settings.

The app **does not** use build-time `VITE_API_BASE_URL` or `VITE_GLOBAL_DISCOUNT_PERCENT` for these values. They are read once at startup from a JSON endpoint.

## Config endpoint

The app loads config from (in order):

1. **`/.well-known/atlas-runtime-config.json`** (preferred)
2. **`/config.json`** (fallback if the first returns 404 or fails)

The request is same-origin (e.g. `https://yoursite.com/.well-known/atlas-runtime-config.json`). The loader uses `cache: "no-store"` so the browser does not reuse an old config.

## Required and optional fields

| Field | Required | Description |
|-------|----------|-------------|
| `apiBaseUrl` | **Yes** | Base URL of the API (e.g. `https://api.example.com`). Must be a valid `http` or `https` URL. Trailing slashes are stripped. |
| `globalDiscountPercent` | No | Number between 0 and 100. Default: `0`. Used for the "Save X%" label and price calculations. |
| `environment` | No | String (e.g. `local`, `dev`, `prod`) for logging or feature flags. |
| `tenantKey` | No | Reserved for future multi-tenant use. |
| `googleMapsApiKey` | No | Google Maps API key if you use dynamic maps. Omit for static map preview. |

Example minimal config:

```json
{
  "apiBaseUrl": "https://atlas-homes-api-dev.azurewebsites.net",
  "globalDiscountPercent": 17,
  "environment": "dev"
}
```

Example with optional fields:

```json
{
  "apiBaseUrl": "https://api.example.com",
  "globalDiscountPercent": 20,
  "environment": "production",
  "tenantKey": "atlas",
  "googleMapsApiKey": "AIza..."
}
```

## How to update config in Cloudflare (and other hosts)

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

The app does **not** depend on Cloudflare (or any host) build-time env vars for `apiBaseUrl` or `globalDiscountPercent`. All such configuration is read from the runtime config file.

## Failure behavior

- If the config request fails (e.g. 404, network error) or the JSON is invalid, the app shows a **fatal error screen**: "Runtime config missing/invalid" and a hint to check `/.well-known/atlas-runtime-config.json`.
- In **local dev** (localhost), the loader also requires that `apiBaseUrl` in the loaded config is a localhost URL. The committed default file satisfies this.

## Troubleshooting

1. **Open the config URL in the browser:**  
   Visit `https://your-domain.com/.well-known/atlas-runtime-config.json`. You should see valid JSON with at least `apiBaseUrl`.

2. **Verify `apiBaseUrl`:**  
   It must be a full `http` or `https` URL (e.g. `https://api.example.com`). No trailing slash is required (the app normalizes it).

3. **Check the console:**  
   If the app shows the error screen, the browser console may log the exact error (e.g. "invalid JSON", "apiBaseUrl is required").

4. **Local dev:**  
   Ensure `public/.well-known/atlas-runtime-config.json` exists and has `apiBaseUrl` pointing to your local API (e.g. `http://localhost:5000`). The app will reject a non-localhost URL when running on localhost.
