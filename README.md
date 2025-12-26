# Atlas Homes Frontend

## Overview
Atlas Homes Frontend is a Vite-powered React + TypeScript single-page application that markets Atlas Homestays inventory and captures booking intent. Routing is centralized in [`src/App.tsx`](src/App.tsx), which mounts global UI elements (navbar, scroll restoration, footer) around page-level routes. The landing experience rendered by [`src/pages/home/Home.tsx`](src/pages/home/Home.tsx) weaves together carousel hero content, featured locations, marketing callouts, and testimonials composed from modular components and the structured property inventory exported by [`src/data.ts`](src/data.ts).

**Trust placement principle:** transactional trust (payments, fees, confirmation) is shown only at decision points such as the search widget or checkout. Brand/experiential trust (e.g., verified homes, locations, flexibility) is shown elsewhere to avoid repetition.
The hero trust row is intentionally limited to three high-signal badges—**Verified homes**, **Secure Razorpay payments**, and **No hidden fees**—to keep scannability high; flexible cancellation is handled in Policies/FAQs/booking flows instead of the badge row.

### Navigation structure
- Primary (desktop & mobile): Home, Apartments, Location, FAQs, Contact
- Header keeps the business phone visible (tel link) alongside a softer-outline Book Now CTA
- Footer carries the destinations that were previously grouped under “More” (Gallery, About Us, Articles, Offers) plus Sitemap/Policies/Terms
- CTA: Book Now now scrolls in-page to the **Our Homes** discovery block (`/#our-homes`) while WhatsApp sits as the secondary “Need help?” link for people who want a human handoff
- Mobile: ordered primary links with collapsible Apartments children; tapping any item closes the menu

Rationale: simplify the header for faster wayfinding, surface FAQs in-place of the former Help label without changing content, and keep the full phone number prominent (especially for India users who prefer to call and negotiate) while retaining but softening the Book Now emphasis.

## Prerequisites
- Node.js **22.12.0+** (required by Vite 7 and enforced in `.nvmrc`/`.node-version`)
- npm **10.9.2+** (ships with the recommended Node releases)
- Modern browser for previewing the development server

Optional tooling:
- Access to the Cloudflare Pages project dashboard for monitoring deployments
- ESLint-compatible editor integration for real-time lint feedback

## Build Environment
- Node **22.12.0** (LTS)
- npm **10.9.2**
- Cloudflare Pages build vars → `NODE_VERSION=22.12.0`, `NPM_FLAGS=--no-audit --no-fund`
- Enforced override → `@jridgewell/sourcemap-codec@1.5.5`

## Environment Variables
- Vite only surfaces variables prefixed with `VITE_`; CRA-style `REACT_APP_*` keys are ignored at runtime. Make sure API hosts use `VITE_API_BASE_URL` rather than the legacy `REACT_APP_API_BASE_URL` name.
- `VITE_API_BASE_URL` (required) → Base URL for all API calls (omit trailing slash). The value is resolved at runtime via [`/config`](functions/config.js) and [`src/config/getApiBaseUrl.ts`](src/config/getApiBaseUrl.ts); if it is missing, the app logs an error and renders a friendly fallback screen instead of a blank page.
- Cloudflare Pages setup:
  - **Production:** Project → Settings → Environment variables → set `VITE_API_BASE_URL` to the production API host. Save for “Production” scope.
  - **Preview:** In the same screen, add `VITE_API_BASE_URL` for the “Preview” scope to point at staging/QA APIs so preview builds load data correctly.
  - Runtime config: Pages Functions serve `/config` that injects `window.__ATLAS_RUNTIME_CONFIG__ = { apiBaseUrl: "..." }`. Changes to the env var apply immediately (no rebuild needed after this change ships); visiting `/config` should return the runtime value or an empty string with a comment if missing. `/config.js` redirects to `/config` to avoid SPA fallbacks while keeping legacy references working.

### Cloudflare Pages settings
- In the Pages project dashboard, set the environment variable `NODE_VERSION=22.12.0` so builds align with Vite 7's engine requirement (\`^20.19.0 || >=22.12.0\`).
- The repo includes `.nvmrc` and `.node-version` set to **22.12.0**; use them locally (e.g., `nvm use`) to match the Pages runtime and avoid EBADENGINE warnings.
- `npm run validate:legal` uses Vitest with the **jsdom** environment; keep `jsdom` installed and available during builds so the validator can parse the DOM-like structures it asserts against.

### Image optimization manifest
- `npm run optimize-images` normalizes JPEG/PNG assets to WebP, cleans outdated variants, and writes a manifest to `src/assets/optimized-manifest.json` (creating the directory if missing) so the app can reference the optimized filenames consistently across local, CI, and Cloudflare Pages builds.

### Branding assets
- The canonical Atlas Homestays logo lives at `https://atlashomestorage.blob.core.windows.net/listing-images/logo-removebg-preview%20(3).be48d403.webp` and is exported as `LOGO_URL` from [`src/config/branding.ts`](src/config/branding.ts) so all layouts (header, footer, hero, property cards) reuse the same source.
- When updating brand imagery, change `LOGO_URL` to keep every consumer in sync instead of hardcoding URLs inside components.

### Lockfile maintenance
- Use Node 20.x (see `.nvmrc`) and run `npm install` to refresh dependencies.
- Always commit the resulting `package-lock.json` so `npm ci` stays in sync locally, in CI, and during Cloudflare builds.

## Quickstart
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Copy environment variables**
   ```bash
   cp .env.example .env
   ```
   Populate the EmailJS identifiers before attempting to send booking/contact forms. Phone/WhatsApp
   numbers are centralized in [`src/config/contact.ts`](src/config/contact.ts) and default to the business line.
3. **Run the development server**
   ```bash
   npm run dev
   ```
   The app binds to `http://localhost:5173` by default. Pass `--host 0.0.0.0` if you need LAN access.
4. **Lint and format checks**
   ```bash
   npm run lint
   ```
5. **Create a production build**
   ```bash
   npm run build
   ```
6. **Preview the production bundle**
   ```bash
   npm run preview
   ```

## Tests
- `npm test` runs the Vitest suite (jsdom) including smoke coverage for the header Book Now anchor and the hero date-range + guests flow.
- Browser E2E can be layered on later with Playwright/Cypress; npm registry restrictions in this environment currently block installing `@playwright/test` directly.

### Booking funnel entry points
- Primary header CTA → `/#our-homes` (scrolls to the Our Homes grid on the homepage)
- Secondary help CTA → WhatsApp link labelled “Need help?”
- Hero search → Builds `/apartments?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2` so listings filter on the chosen stay window and party size

## Theming
- CSS variables for the active palette are defined per theme in `src/styles/themes/*.css` and loaded globally via `src/styles/themes/index.css`.
- `applyTheme(themeKey)` in [`src/styles/theme.ts`](src/styles/theme.ts) applies the `data-theme` attribute on `<html>` while falling back to the default when an unknown key is provided.
- To add a seasonal palette: duplicate `src/styles/themes/default.css` into a new file (for example, `valentine.css`), adjust the variable values, import it in `src/styles/themes/index.css`, and register the key in `themeRegistry` inside `src/styles/theme.ts`. Components do not need refactors because they already consume semantic tokens.
- For semantic token intent, CTA discipline, z-index governance, safe-area usage, and theme QA steps, see the [Design system and theming guide](docs/design-system.md).

### Homepage search controls
- The hero booking bar uses a `react-date-range` calendar for check-in/check-out with a single summary line (e.g., `22 Dec 2025 – 23 Dec 2025 · 2 guests`).
- Query params flow through `checkIn`, `checkOut`, and `guests` so `/apartments` can hydrate filters on reload or direct links.
- Validation enforces check-out after check-in and defaults to at least one guest; guest steppers cap the party size to 16.

## Project Map
| Path | Description |
| --- | --- |
| `src/main.tsx` | Entry point bootstrapping React with router context and Tailwind global styles. |
| `src/App.tsx` | Declares `BrowserRouter` routes for the home page, property detail views, location collections, and 404 handling while wrapping shared layout pieces. |
| `src/pages/Policies.tsx` | Single-column policies page with anchored sections, SEO metadata (title/description/canonical), and deep-linkable table of contents. |
| `src/pages/home/Home.tsx` | Home hero, location scroller, parallax CTA, and marketing sections composing homepage modules. |
| `src/components/homepage_components/homepage_locations/HomePage_Locations.tsx` | Grid of property cards sourced from `LISTINGS`, featuring the Penthouse layout and linking to slugged property detail views when data exists. |
| `src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx` | Property detail page rendering gallery, amenities, booking widget, and policies from `propertyData`. |
| `src/components/homepage_components/homepage_locationsdetails/Homepage_LocationDetails.tsx` | Location-deep page with filters, hero carousel, and booking modal for grouped listings. |
| `src/data.ts` | Source of property metadata, navigation content, and footer links consumed across the UI. |
| `src/components/commonComponents/navbar/Navbar.tsx` / `footer/Footer.tsx` | Global navigation/header ribbon and footer contact blocks. |
| `docs/` | Working notes covering the API guide and first PR starter; see `ONBOARDING.md`, `ARCHITECTURE.md`, `RUNBOOK.md`, and `SECURITY.md` for the comprehensive onboarding, architecture, operations, and security docs. |

### “Our Homes” card conversion updates
- **Explicit CTAs:** Each listing card now renders a primary “View room” button (plus an optional “Check dates” deep link when hero search dates exist) so the next action is obvious on desktop and mobile.
- **Cleaner imagery:** Carousel dots are lighter and only surface on hover/focus for desktop while staying subtle on mobile; the legacy play icon is removed unless a video source exists in the future.
- **Price hierarchy:** Pricing compresses to a concise stack—strike-through MRP (when discounted), bold nightly rate, and a single savings line—removing redundant copy while keeping `/ night` visible.
- **Trust cues:** Discount badges use meaningful labels (defaulting to “Best price on our website” when a discount is present), and a compact amenities row surfaces Wi‑Fi/AC (with icons) per unit for faster trust-building.

## Routes & deep links
- `/faq` → FAQ hub with accordion sections and WhatsApp CTA
- `/faq#cancellation-refunds` → scrolls to the Cancellation & Refunds section
- `/faq#refund-timeline` → opens the refund timeline question

## Common Tasks
| Goal | Command |
| --- | --- |
| Start dev server with network access | `npm run dev -- --host 0.0.0.0` |
| Run ESLint across the project | `npm run lint` |
| Build production assets | `npm run build` |
| Preview built assets locally | `npm run preview` |
| Trigger Cloudflare Pages deployment | Push to `main` (Pages builds with `npm run build`) |

## Short-link redirects
- Short-link redirects live in [`public/_redirects`](public/_redirects) so Vite copies them verbatim into the Pages build output.
- Targets must stay **relative** (e.g., `/property_details/atlas-homes-room-101`) to automatically preserve the current host on dev and production; hardcoding `https://www.atlashomestays.com` would break dev URLs.
- Ordering matters: the short-link rules should stay at the top of `_redirects`, and the SPA fallback of `/* /index.html 200` must remain last to avoid swallowing redirects.

### Verification commands
Use `curl -I` to confirm redirects keep the current domain and point at the right slug:

```bash
curl -I https://dev.atlashomestays.com/101
curl -I https://dev.atlashomestays.com/102
curl -I https://dev.atlashomestays.com/201
curl -I https://dev.atlashomestays.com/202
curl -I https://dev.atlashomestays.com/301
curl -I https://dev.atlashomestays.com/302
curl -I https://dev.atlashomestays.com/501
```

Each command should return a 301/302 with a `Location` header set to `/property_details/<slug>` (no `www.atlashomestays.com` host).

**Acceptance criteria**
- Dev short links (e.g., `https://dev.atlashomestays.com/101`) never redirect to `www.atlashomestays.com`.
- All listed short links return a redirect to the matching `/property_details/<slug>` path on both dev and production.
- `_redirects` contains only relative targets for short links, with the SPA fallback left last.

## Troubleshooting
- **Node version errors:** Verify `node -v` meets the prerequisite range. Use `nvm` or `fnm` to align versions.
- **Port 5173 already in use:** Override with `npm run dev -- --port 5174` or free the port before starting Vite.
- **Blank property pages:** Ensure navigation via the homepage so React Router receives the `location.state` payload required by [`Homepage_LocationDetails`](src/components/homepage_components/homepage_locationsdetails/Homepage_LocationDetails.tsx).
- **Runtime blank screens:** The app is wrapped in an error boundary. If a page fails, the boundary renders a fallback and the console shows the captured error; use the Reload button to recover.
- **Asset resolution rules:** Place shared images (e.g., the brand logo) in `src/assets/` to leverage `resolveOptimizedAsset`, or reference files in `public/` with absolute paths like `/logo.svg` so Vite serves them without import errors. Prefer SVGs or other text-based assets when possible to avoid binary diffs.
- **Email delivery fails:** Confirm the EmailJS service, template, and public keys are filled in `.env` and referenced in [`BookingFrom.tsx`](src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx) and [`ContactUs.tsx`](src/pages/contactus/ContactUs.tsx).
- **Cloudflare deployment issues:** Ensure the Pages build command (`npm run build`) succeeds locally; failed builds prevent deploys.

## Listings
- Featured listing: mark `featured: true` in [`src/data/listings.ts`](src/data/listings.ts). Images are auto-loaded from `src/assets/<unit>/`.

## Blog and Policies updates
- **Add a blog post:** edit `src/data/blogPosts.ts` and append a new object with `title`, `slug`, `category` (`guest-guides` or `hospitality-tech`), `excerpt`, `content`, and optional `featuredImage`, `metaTitle`, and `metaDescription`. The routes `/blog`, `/blog/:category`, and `/blog/:slug` automatically surface new entries.
- **Policies route:** `/policies` renders a single-column page with a table of contents and anchored sections (e.g., `#cancellation-refund-policy`, `#house-rules`). The header and footer link to these anchors, so keep the IDs stable.
- **Edit policies:** update the content blocks in `src/pages/Policies.tsx` to change wording or add new clauses while keeping the existing anchors to preserve deep links from navigation and the footer.
- **Booking confirmations:** the booking confirmation alerts and EmailJS payloads reference the policy URL and cancellation/reschedule anchors (see `BookingFrom.tsx`). Update the shared `policyMessage` string there if the canonical URL ever changes.
- **Sitemap URL:** served from a Cloudflare Pages Function at `/sitemap.xml`, which builds entries from the incoming request origin so preview/staging domains emit the correct links; `public/robots.txt` references the same path.

### Terms & Conditions and stay policies
- **Content source:** `src/content/terms.ts` holds the numbered Terms & Conditions sections, inline policy snippets, and the Razorpay consent note used across the booking flow.
- **Route:** `/terms` (aliased at `/terms-and-conditions`) renders the structured terms page defined in `src/pages/Terms.tsx` with anchor links and last-updated metadata.
- **Unit timings & fees:** `src/config/policyConfig.ts` centralizes per-unit check-in/out windows and extra-guest fee ranges (`baseGuestAllowance`, `unitPolicies`).
- **UI reuse:** booking widgets (`BookingFrom.tsx`, `hotelBooking_form/HotelBooking_Form.tsx`) and property details (`Homepage_PropertyDetails.tsx`) pull inline snippets and timing data from those sources to avoid hardcoded strings.

## Pricing configuration
- Centralized in [`src/config/pricing.config.ts`](src/config/pricing.config.ts) with helpers in [`src/utils/pricing.ts`](src/utils/pricing.ts). The config tracks per-unit base rates (`1bhk: ₹3,500`, `penthouse: ₹6,000`), included guests (2 by default), a global discount (`17%`), a New Year’s Eve multiplier (`"12-31": 2`), currency/timezone, rounding rules, and optional extras (extra guest fees, max guests, cleaning fees).
- Env overrides (ideal for Cloudflare Pages) let you adjust pricing without rebuilding:
  - `VITE_GLOBAL_DISCOUNT_PERCENT` → overrides the discount (e.g., `15` for 15% off).
  - `VITE_DATE_MULTIPLIERS_JSON` → JSON map of `"MM-DD": multiplier` (e.g., `{"12-31":2,"01-01":1.25}`).
- `calculateNightlyPrice` applies the config + overrides in this order: base rate → discount → date multiplier (per night) → extra-guest fees (if configured) → rounding. For multi-night stays, the Dec 31 multiplier is applied **only** to that night.
- Example outcomes (before fees/taxes):
  - 1BHK on Dec 30: base ₹3,500 → 17% discount → **₹2,905** per night.
  - 1BHK on Dec 31: discounted ₹2,905 → 2× multiplier → **₹5,810** per night.
  - Penthouse on normal dates: base ₹6,000 → 17% discount → **₹4,980** per night (₹9,960 on Dec 31 with the 2× multiplier).
- To change prices safely, edit the config for permanent defaults or set env vars for temporary promos; keep the currency/timezone aligned with INR/Asia-Kolkata to avoid date-key drift for `"MM-DD"` multipliers.
- Discount and special-day badge copy for UI surfaces is centralized in [`src/config/priceDisplay.config.ts`](src/config/priceDisplay.config.ts) to keep strike-through labels and special pricing tags API-ready.

## Legal content model and validation

The Help area (Policies, FAQs, Terms) uses a single source of truth located in `src/content/legal/`. Edit `terms.ts` first, then reference those IDs from `policies.ts` (summaries) and `faqs.ts` (answers). Every policy must include `termsRefs` pointing to valid Terms IDs, and every FAQ needs at least one `linksTo` entry pointing to a policy or terms section. A build/test-time validator (`npm run validate:legal`) blocks builds if IDs are missing, unknown, or if risky promises in Policies/FAQs are not tied back to the Terms.

Shared layout components live under `src/components/legal/` and provide tabs, sticky section navigation, and search for Policies/FAQs. The “Help” navigation group in the header/footer links to all three pages without duplicating content.
