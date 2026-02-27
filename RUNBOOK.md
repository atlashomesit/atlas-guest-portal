# Runbook

This runbook captures the day-to-day operational tasks for the Atlas Homes Frontend.

## Build & Test
1. Pull the latest `main` branch and install dependencies.
2. Execute:
   ```bash
   npm run lint
   npm run build
   ```
3. Confirm `dist/` is generated without TypeScript or ESLint errors.
4. When adding or adjusting themes, follow the [Design system and theming guide](docs/design-system.md) for token usage, z-index scale, and safe-area requirements.

## Deployment (Cloudflare Pages)
1. Merge or push the desired commit to the `main` branch; Cloudflare Pages automatically runs `npm run build` and publishes the static bundle.
2. Monitor the deployment from the Pages dashboard. Re-run the build if necessary using the "Retry deployment" action.
3. Validate deployment by visiting the production URL and checking:
   - Navbar renders contact info from [`footerData`](src/data.ts).
   - Routes navigate correctly (`/`, `/property_details/<slug>`).
   - EmailJS forms fail gracefully if credentials are absent (expected in staging environments).

## Rolling Back
1. Identify the previous stable tag/commit in `main`.
2. Trigger a redeploy of that commit from the Cloudflare Pages dashboard (use the "Retry deployment" action on the desired revision).
   - If necessary, create a temporary branch and open a pull request that reverts to the stable commit, then merge to `main` to publish.
3. Create a hotfix issue outlining the regression and mitigation status.

## EmailJS Credential Rotation
1. Generate new service/template/public keys in EmailJS.
2. Update the deployment secrets (`.env`) for each environment.
3. If keys are hard-coded (see [`BookingFrom.tsx`](src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx) and [`ContactUs.tsx`](src/pages/contactus/ContactUs.tsx)), coordinate a patch release replacing literals with the new keys or env accessors.
4. Run a smoke test submission per environment to confirm delivery.

## Updating Property Inventory
1. Edit `propertyData` in [`src/data.ts`](src/data.ts).
2. Verify slug generation still matches property names for routing.
3. Run `npm run build` to ensure the new dataset compiles.
4. Share release notes summarizing property additions/removals.

## Incident Response
1. **Site down / blank screen:**
   - Check browser console for build errors.
   - Re-run `npm run build` locally to reproduce.
   - Roll back to last known good deployment if necessary.
2. **Broken routing:**
   - Confirm navigation flows in `src/App.tsx` and `HomePage_Locations` remain unchanged.
   - Validate `location.state` is supplied when deep-linking location pages.
3. **Email delivery failure:**
   - Verify EmailJS status page.
   - Ensure credentials are valid and not rate-limited.
   - Collect error logs from the browser console and coordinate with EmailJS support if needed.

Document incident outcomes in the project tracker to inform future automation opportunities.
