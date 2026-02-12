# Cloudflare Pages env var runbook

## Purpose
Use this runbook when Cloudflare Pages build logs show `VITE_GLOBAL_DISCOUNT_PERCENT` as missing.

`VITE_GLOBAL_DISCOUNT_PERCENT` is a **build-time Vite variable**, so the value is embedded during build. Changing it in Cloudflare Pages requires a **new deployment** before the site reflects it.

## Verify deployment type (Production vs Preview)
1. Open **Workers & Pages → your Pages project → Deployments**.
2. Open the relevant deployment and check whether it is marked **Production** or **Preview**.
3. In this repository, the production branch is `dev`, so deployments built from `dev` should be treated as production.
4. In build logs, confirm the verification output from `scripts/verify-pages-env.mjs`:
   - `CF_PAGES`
   - `CF_PAGES_BRANCH`
   - `CF_PAGES_URL`
   - `VITE_GLOBAL_DISCOUNT_PERCENT`
   - all `VITE_*` keys

## Important behavior: Retry vs new production build
- **Retry deployment** usually re-runs the same deployment context (for example Preview remains Preview).
- If you need the new Production-scoped variable to apply, push a **new commit** to trigger a fresh production build.

## Avoid the "two Pages projects" trap
If multiple Pages projects or domains exist:
1. Confirm which Pages project serves the live domain.
2. Edit env vars in that exact project.
3. Set variable scope for the correct environment (Production vs Preview).

## Resolution checklist
- [ ] Confirm deployment is in the expected environment (Production for branch `dev`).
- [ ] Set `VITE_GLOBAL_DISCOUNT_PERCENT` in the correct Pages project.
- [ ] Set it in the correct scope (Production, and Preview if desired).
- [ ] Purge build cache (if your workflow uses cached builds).
- [ ] Trigger a new build from a new commit.
- [ ] Verify build log prints the expected value from `scripts/verify-pages-env.mjs`.

## References
- Cloudflare Pages build environment variables:
  - https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
- Cloudflare Pages preview deployments:
  - https://developers.cloudflare.com/pages/configuration/preview-deployments/
