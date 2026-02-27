# Onboarding Guide

Welcome to the Atlas Homes Frontend project! This guide walks you through environment setup, codebase orientation, and the first validation steps to become productive quickly.

## 1. Access & Tooling
1. Install Node.js 18.18+ (LTS) and npm 9+. Consider `nvm`/`fnm` for version switching.
2. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd RatebotaiRepo
   npm install
   ```
3. Copy environment variables and add EmailJS credentials:
   ```bash
   cp .env.example .env
   ```
   - Ask an existing maintainer for the `VITE_EMAILJS_*` keys and `VITE_OWNER_EMAIL` inbox.
   - Required values:
     - `VITE_EMAILJS_SERVICE_ID`
     - `VITE_EMAILJS_TEMPLATE_ID`
     - `VITE_EMAILJS_PUBLIC_KEY`
     - `VITE_OWNER_EMAIL`
4. (Optional) Request access to the Cloudflare Pages project so you can monitor build logs and trigger redeploys from the dashboard.

## 2. Verify the Application
1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:5173`.
3. Smoke test the homepage:
   - Scroll through the hero slider and featured locations provided by [`Home`](src/pages/home/Home.tsx).
   - Click a location card to ensure routing to [`Homepage_PropertyDetails`](src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx) works.
   - Confirm the footer contact links render from [`footerData`](src/data.ts).
4. Trigger a sample booking submission and a contact form submission using EmailJS sandbox credentials and verify each succeeds (or fails with the missing-configuration alert if credentials are absent). Use the "Contact" link in the navigation (or go directly to [`/contact`](src/App.tsx)) to reach the form and confirm the page renders as expected.

## 3. Explore the Codebase
- Start at [`src/App.tsx`](src/App.tsx) to understand routing, navbar visibility toggles, and layout scaffolding.
- Review [`src/data.ts`](src/data.ts) to understand property metadata, navigation content, and icon mapping consumed throughout the UI.
- Inspect shared UI components in `src/components/commonComponents` (navbar, footer, heading, subheading) to align on styling conventions.
- Browse homepage modules in `src/components/homepage_components` to see how marketing sections and sliders are composed.

## 4. Development Workflow
- Follow the branching workflow described in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Use `npm run lint` before submitting changes to catch TypeScript and React best-practice violations.
- When adding new property data, update both the TypeScript source (`src/data.ts`) and any dependent UI to handle new attributes.

## 5. First Contribution Checklist
- [ ] Confirm you can run `npm run dev` without runtime errors.
- [ ] Fill in `.env` with valid EmailJS keys (or placeholders if you are waiting on credentials).
- [ ] Read through [`ARCHITECTURE.md`](ARCHITECTURE.md) to understand the page flow and integration points.
- [ ] Complete the starter issue in [`docs/first-pr.md`](docs/first-pr.md).

Welcome aboard—reach out to the maintainers if anything is unclear or missing from this guide!
