# Guest Portal: Dev/Prod API base URL wiring

Short runbook for wiring the Guest Portal API base URL in **Cloudflare Pages**.

## 1) Cloudflare Pages → Project → Settings → Environment variables

Open the Guest Portal project in **Cloudflare Pages** and navigate to **Settings → Environment variables**.

## 2) Add variable name (exact)

Add the variable name **exactly** as used in code:

* `VITE_API_BASE_URL`

## 3) Set values for each environment

Set the values in the correct environment section:

* **Production** → `https://atlas-homes-api-gxdqfjc2btc0atbv.centralus-01.azurewebsites.net`
* **Preview (dev branch only)** → `https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net`

## 4) Dev API with `/api` (UsePathBase)

If the dev API uses `UsePathBase` and requires `/api`, set the full value **including** `/api` (for example, `https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net/api`).

## 5) Redeploy + verify

After changing the env var, **trigger a redeploy** (use **Retry last build** in Cloudflare Pages). Then verify in the browser console:

* The base URL should be printed **once** on app load.
