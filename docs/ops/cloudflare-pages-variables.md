# Cloudflare Pages: Vite environment variables

This guide describes where to set Vite environment variables in **Cloudflare Pages** for each environment so deployments are deterministic.

## Where to set variables

In Cloudflare Pages, open your project and go to **Settings → Environment variables**. Add variables in each applicable section (Production, Preview, or Branch).

### `VITE_API_BASE_URL`

* **Production** → production API base URL.
* **Preview** → preview/staging API base URL (e.g. for dev.atlashomestays.com if it uses Preview).
* **Branch** (optional) → per-branch overrides.

### `VITE_GLOBAL_DISCOUNT_PERCENT`

Global discount percentage shown on listings (e.g. "Save 17%"). Value is the number only (e.g. `17`, `10`, `0`). If unset, the app uses the code default (17%).

* Set in **Production** and **Preview** (and Branch if needed) to the desired percentage for each environment.

## Build-time behavior (Vite)

Vite environment variables are **build-time only**. After adding or changing any `VITE_*` variable in Cloudflare Pages, you must **trigger a new deployment** (e.g. **Deployments** → **…** → **Retry deployment**) for the change to take effect.

## Verifying variables in build logs

The `npm run build` script logs `VITE_GLOBAL_DISCOUNT_PERCENT` at the start of the build. In Cloudflare **Deployments** → select a deployment → **View build** (or **Build log**), search for `VITE_GLOBAL_DISCOUNT_PERCENT`. You should see either the configured number or `NOT SET`. If you see `NOT SET`, add the variable for the correct environment (Production and/or Preview, as **Text** not Secret) and retry the deployment.

## Naming conventions

* Use the `VITE_*` prefix only for variables that must be exposed to the Vite client bundle.
* Required for this app: `VITE_API_BASE_URL`. Optional: `VITE_GLOBAL_DISCOUNT_PERCENT`.
