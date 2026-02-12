# Cloudflare Pages: configuration

## API base URL and discount (runtime config)

The app **does not** use build-time environment variables for the API base URL or global discount percentage. Those values are read at **runtime** from:

**`/.well-known/atlas-runtime-config.json`**

So you do **not** need to set `VITE_API_BASE_URL` or `VITE_GLOBAL_DISCOUNT_PERCENT` in Cloudflare Pages for the app to work. Instead:

1. Ensure the deployed site serves a valid `/.well-known/atlas-runtime-config.json` (see [Runtime config runbook](../runbooks/runtime-config.md)).
2. For per-environment values (dev vs prod), **override** that file per deployment (e.g. via a build step that writes the JSON from Cloudflare env vars, or a Pages Function that serves it from env). That way you can change the API URL or discount without rebuilding the app.

## Other build-time variables (unchanged)

Any remaining `VITE_*` or other env vars (e.g. for analytics, feature flags) are still build-time. Set them under **Settings → Environment variables** (Production / Preview) and trigger a new deployment for changes to apply.

## Naming conventions

- Use the `VITE_*` prefix only for variables that must be exposed to the Vite client bundle.
- For API URL and discount, use the runtime config file; see the [runtime config runbook](../runbooks/runtime-config.md).
