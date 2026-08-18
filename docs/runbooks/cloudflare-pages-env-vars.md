# Cloudflare Pages env var runbook

## Purpose
Use this runbook when troubleshooting Cloudflare Pages builds or deployment environment.

**Note:** API base URL and global discount are **not** build-time env vars. They are loaded at app startup from runtime config (see [runtime-config.md](./runtime-config.md)). The build does **not** require `VITE_API_BASE_URL` or `VITE_GLOBAL_DISCOUNT_PERCENT`.

## Configuration variables (Pages Settings → Environment variables)

The app reads API base URL and discount at **runtime** from **`/.well-known/atlas-runtime-config.json`**. A Pages Function serves that URL from environment variables. Set for Production and/or Preview:

| Variable | Required | Example |
|----------|----------|---------|
| `ATLAS_API_BASE_URL` | **Yes** | `https://atlas-homes-api-dev.azurewebsites.net` (dev) or your production API URL |
| `ATLAS_GLOBAL_DISCOUNT_PERCENT` | No | `17` (for 17% discount) |
| `ATLAS_ENVIRONMENT` | No | `dev` or `production` |
| `ATLAS_GOOGLE_MAPS_API_KEY` | No | Your Google Maps API key |
| `ATLAS_WORKER_PROXY_SECRET` | **Yes for wildcard** (TASK-7464 / TASK-7207) | Same value as Worker secret `ATLAS_WORKER_PROXY_SECRET` (`wrangler secret put` in `workers/tenant-subdomain-router/`). Pages middleware trusts `X-Forwarded-Host` only when `X-Atlas-Worker-Proxy` matches. |

Without `ATLAS_API_BASE_URL`, the app shows "Runtime config missing/invalid". See [runtime-config.md](./runtime-config.md).

**Naming conventions:** Use the `VITE_*` prefix only for variables that must be exposed to the Vite client bundle. For API URL and discount, use the runtime config file. Other build-time vars (analytics, feature flags) go under Settings → Environment variables; trigger a new deployment for changes to apply.

## Verify deployment type (Production vs Preview)
1. Open **Workers & Pages → your Pages project → Deployments**.
2. Open the relevant deployment and check whether it is marked **Production** or **Preview**.
3. In this repository, the production branch is `dev`, so deployments built from `dev` should be treated as production.
4. In build logs, confirm the diagnostic output from `scripts/verify-pages-env.mjs`:
   - `CF_PAGES`
   - `CF_PAGES_BRANCH`
   - `CF_PAGES_URL`
   - all `VITE_*` keys (optional; none required for app to work)

## Important behavior: Retry vs new production build
- **Retry deployment** usually re-runs the same deployment context (for example Preview remains Preview).
- If you need a new Production deployment, push a **new commit** to trigger a fresh production build.

## Avoid the "two Pages projects" trap
If multiple Pages projects or domains exist:
1. Confirm which Pages project serves the live domain.
2. Edit env vars in that exact project.
3. Set variable scope for the correct environment (Production vs Preview).

## Configuring API URL and discount (production)
See [runtime-config.md](./runtime-config.md). Values are served via `/.well-known/atlas-runtime-config.json` (e.g. via Cloudflare redirects or Workers), not via Pages build env vars.

## References
- [Runtime config runbook](./runtime-config.md)
- Cloudflare Pages build environment variables:
  - https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
- Cloudflare Pages preview deployments:
  - https://developers.cloudflare.com/pages/configuration/preview-deployments/
