# Cloudflare Pages: configuration

## API base URL and discount (runtime config)

The app reads API base URL and discount at **runtime** from **`/.well-known/atlas-runtime-config.json`**. A Pages Function in this repo serves that URL from environment variables, so you **must** set them in Cloudflare Pages for dev/production to work.

**Pages → your project → Settings → Environment variables** (set for Production and/or Preview):

| Variable | Required | Example |
|----------|----------|---------|
| `ATLAS_API_BASE_URL` | **Yes** | `https://atlas-homes-api-dev.azurewebsites.net` (dev) or your production API URL |
| `ATLAS_GLOBAL_DISCOUNT_PERCENT` | No | `17` (for 17% discount) |
| `ATLAS_ENVIRONMENT` | No | `dev` or `production` |
| `ATLAS_GOOGLE_MAPS_API_KEY` | No | Your Google Maps API key |

Without `ATLAS_API_BASE_URL`, the app will show “Runtime config missing/invalid” and the dev site would try to use the static fallback (localhost, 0% discount). See [Runtime config runbook](../runbooks/runtime-config.md) for details.

## Other build-time variables (unchanged)

Any remaining `VITE_*` or other env vars (e.g. for analytics, feature flags) are still build-time. Set them under **Settings → Environment variables** (Production / Preview) and trigger a new deployment for changes to apply.

## Naming conventions

- Use the `VITE_*` prefix only for variables that must be exposed to the Vite client bundle.
- For API URL and discount, use the runtime config file; see the [runtime config runbook](../runbooks/runtime-config.md).
