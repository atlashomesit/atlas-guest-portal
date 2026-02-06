# Cloudflare Pages proof: build-time `VITE_API_BASE_URL`

Use this checklist to prove (with evidence) which Cloudflare Pages environment is serving `dev.atlashomestays.com` **and** that the `VITE_API_BASE_URL` value was injected at build time.

## 1) Identify which Cloudflare Pages environment serves `dev.atlashomestays.com`

1. Open **Cloudflare Dashboard → Pages → your project**.
2. Click **Custom domains**.
3. Find `dev.atlashomestays.com` in the list.
4. Record the **Environment** value shown for that domain:
   - **Production** → requests go to the production environment.
   - **Preview** → requests go to a preview environment.
   - If it shows a specific **branch**, requests go to that preview branch environment.
5. Click the environment/deployment entry for `dev.atlashomestays.com` and confirm the **Deployment** details (commit SHA, build time, and branch) match the intended environment.

> Result: You now have Cloudflare evidence that the custom domain is bound to Production vs Preview (or a specific branch preview).

## 2) Confirm build-time `VITE_API_BASE_URL` injection in the deployed bundle

1. Open `https://dev.atlashomestays.com` in Chrome (or your preferred browser).
2. Open **DevTools → Sources**.
3. Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> (global search) and search for:
   - `azurewebsites.net` (the Azure host string), **or**
   - the expected base URL value.
4. Inspect the matching bundled file and verify the literal base URL string is embedded in the built JavaScript.

> Result: If the base URL string is present in the bundle, that value was injected at **build time**, which means Cloudflare Pages must rebuild and redeploy for changes to take effect.

## 3) Redeploy after changing Cloudflare Pages environment variables (build-time Vite envs)

1. Open **Cloudflare Dashboard → Pages → your project → Settings → Environment variables**.
2. Update `VITE_API_BASE_URL` in the correct environment scope:
   - **Production** for the production environment.
   - **Preview** for all preview builds.
   - **Specific preview branch** if you need a single branch to differ.
3. **Redeploy is required** because Vite environment variables are **build-time**:
   - Go to **Deployments**.
   - Pick the deployment tied to the environment serving `dev.atlashomestays.com`.
   - Click **Retry deployment** (or trigger a new build by pushing a commit).
4. Wait for the new build to finish and confirm the new deployment is the one attached to `dev.atlashomestays.com` (see Step 1).
5. Repeat Step 2 to verify the new base URL string appears in the bundle.

> Result: You have proof that changing `VITE_API_BASE_URL` requires a Cloudflare Pages redeploy, because the value is compiled into the build output.

## 4) Confirm the runtime log from Task B

1. Open `https://dev.atlashomestays.com`.
2. Open **DevTools → Console**.
3. Find the startup log that prints the resolved API base URL:
   - It should look like: `Startup env: MODE=..., PROD=..., VITE_API_BASE_URL=...`.
4. Confirm the printed `VITE_API_BASE_URL` value matches the expected Cloudflare Pages environment value.

> Result: The runtime log confirms which `VITE_API_BASE_URL` value the built app is using in production.
