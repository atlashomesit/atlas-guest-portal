# Atlas Homes Frontend

## Overview
Atlas Homes Frontend is a Vite-powered React + TypeScript single-page application that markets Atlas Homestays inventory and captures booking intent. Routing is centralized in [`src/App.tsx`](src/App.tsx), which mounts global UI elements (navbar, scroll restoration, footer) around page-level routes. The landing experience rendered by [`src/pages/home/Home.tsx`](src/pages/home/Home.tsx) weaves together carousel hero content, featured locations, marketing callouts, and testimonials composed from modular components and the structured property inventory exported by [`src/data.ts`](src/data.ts).

### Navigation structure
- Primary (desktop): Apartments, Location, FAQ, Policies, Contact
- "More" dropdown: Gallery, About Us, Articles (routes to `/blog`), Offers
- CTA: Book Now button remains a WhatsApp booking handoff
- Mobile: primary links plus a collapsible "More" group; tapping any item closes the menu

## Prerequisites
- Node.js **18.18+** or **20.0+** (required by Vite 5)
- npm **9+** (ships with the recommended Node releases)
- Modern browser for previewing the development server

Optional tooling:
- Access to the Cloudflare Pages project dashboard for monitoring deployments
- ESLint-compatible editor integration for real-time lint feedback

## Build Environment
- Node **20.18.1** (LTS)
- npm **10+**
- Cloudflare Pages build vars → `NODE_VERSION=20.18.1`, `NPM_FLAGS=--no-audit --no-fund`
- Enforced override → `@jridgewell/sourcemap-codec@1.5.5`

### Image optimization manifest
- `npm run optimize-images` normalizes JPEG/PNG assets to WebP, cleans outdated variants, and writes a manifest to `src/assets/optimized-manifest.json` (creating the directory if missing) so the app can reference the optimized filenames consistently across local, CI, and Cloudflare Pages builds.

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
   Populate the EmailJS identifiers before attempting to send booking/contact forms. Add the WhatsApp
   contact number for chat CTAs:
   ```bash
   VITE_WHATSAPP_PHONE_E164=919999999999
   ```
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
- **Sitemap URL:** a static sitemap is served from `public/sitemap.xml` and referenced in `public/robots.txt` for Cloudflare Pages deployments.

### Terms & Conditions and stay policies
- **Content source:** `src/content/terms.ts` holds the numbered Terms & Conditions sections, inline policy snippets, and the Razorpay consent note used across the booking flow.
- **Route:** `/terms` (aliased at `/terms-and-conditions`) renders the structured terms page defined in `src/pages/Terms.tsx` with anchor links and last-updated metadata.
- **Unit timings & fees:** `src/config/policyConfig.ts` centralizes per-unit check-in/out windows and extra-guest fee ranges (`baseGuestAllowance`, `unitPolicies`).
- **UI reuse:** booking widgets (`BookingFrom.tsx`, `hotelBooking_form/HotelBooking_Form.tsx`) and property details (`Homepage_PropertyDetails.tsx`) pull inline snippets and timing data from those sources to avoid hardcoded strings.
