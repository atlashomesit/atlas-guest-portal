# Repo Discovery Report

## Executive Summary
Atlas Homes Frontend is a React 18 + TypeScript single-page marketing site built with Vite and Tailwind CSS. It showcases property inventory defined in-code (`src/data.ts`) and enables booking/contact outreach via EmailJS integrations. Static hosting is provided by Cloudflare Pages.

## Tech Stack Overview
| Layer | Technology | Notes |
| --- | --- | --- |
| UI | React 18, TypeScript, JSX | Functional components with hooks, client-side routing.
| Tooling | Vite 5, ESLint, Tailwind CSS | Fast HMR dev server, linting through `npm run lint`.
| Routing | React Router DOM v6 | Declared in [`src/App.tsx`](src/App.tsx) with nested layout wrapper.
| Assets | Swiper, Fancybox, React Icons | Powers carousels, galleries, and iconography.
| Integrations | EmailJS | Booking/contact forms send emails via REST API keys.
| Hosting | Cloudflare Pages | Cloudflare Pages builds `dist/` from `npm run build` and serves static assets.

## Architecture Artifacts
- System context and component interaction diagrams live in [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Key flows:
  - Homepage composition (`Home`) → property cards (`HomePage_Locations`) → detail views (`Homepage_PropertyDetails`).
  - Scroll restoration and layout wrappers orchestrated by `AppWrapper` in [`src/App.tsx`](src/App.tsx).

## Inventory Highlights
| Area | Key Files |
| --- | --- |
| Entry & Routing | `src/main.tsx`, `src/App.tsx`, `src/ScrollTop.tsx`
| Homepage Sections | `src/pages/home/Home.tsx`, `src/components/homepage_components/*`
| Data Sources | `src/data.ts` (properties, nav/footer), assets under `src/assets/`
| Forms & Integrations | `src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx`, `src/pages/contactus/ContactUs.tsx`
| Shared UI | `src/components/commonComponents/navbar/Navbar.tsx`, `footer/Footer.tsx`, `heading/Heading.tsx`

## Risks & Gaps
1. **Hard-coded EmailJS keys** in `ContactUs.tsx` and blank placeholders in `BookingFrom.tsx` complicate environment configuration and risk credential leakage.
2. **Client-side data coupling:** All property data is bundled in `src/data.ts`, making updates require redeploys and increasing bundle size.
3. **Deep-link fragility:** `Homepage_LocationDetails` expects router state to contain nested data; direct URL access without state can fail.
4. **Lack of automated tests:** No unit or integration tests exist; regressions rely on manual QA.

## Roadmap Recommendations
### Day 1
- Replace hard-coded EmailJS identifiers with environment-driven values (see `.env.example`).
- Document fallback behavior for location pages and ensure slug-based lookups when state is missing.

### Week 1
- Extract property inventory into JSON fetched at runtime or integrate with a lightweight CMS.
- Add smoke-level Cypress or Playwright tests covering homepage navigation and booking form validation.
- Configure CI to run `npm run lint` and `npm run build` on pull requests.

### Month 1
- Implement backend API or CDN-backed data source for dynamic pricing/availability.
- Add analytics/telemetry to understand engagement (ensure consent and privacy compliance).
- Build admin tooling or documentation to streamline property onboarding and EmailJS credential rotation.

## External Contracts & APIs
- EmailJS is the only active external API; see `docs/api/README.md` for details or placeholders.
