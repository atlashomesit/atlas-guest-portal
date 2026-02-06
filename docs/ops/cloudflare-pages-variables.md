# Cloudflare Pages: Vite environment variables

This guide describes where to set the `VITE_API_BASE_URL` variable in **Cloudflare Pages** for each environment so deployments are deterministic.

## Where to set `VITE_API_BASE_URL`

In Cloudflare Pages, open your project and go to **Settings → Environment variables**. Add `VITE_API_BASE_URL` in each applicable section:

### Production

* **Production** tab → add `VITE_API_BASE_URL` with the production API base URL.

### Preview

* **Preview** tab → add `VITE_API_BASE_URL` with the preview/staging API base URL.

### Branch (if applicable)

* **Branch** tab → add `VITE_API_BASE_URL` for any branch-specific overrides (for example, a per-branch review API endpoint).

## Build-time behavior (Vite)

Vite environment variables are **build-time only**. After changing `VITE_API_BASE_URL` in Cloudflare Pages, you must **trigger a new deployment** for the change to take effect.

## Naming conventions

* Use the `VITE_*` prefix only for variables that must be exposed to the Vite client bundle.
* For this app, only `VITE_API_BASE_URL` is required.
