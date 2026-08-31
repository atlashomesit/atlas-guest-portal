# Onboarding Guide

> **For full system setup (API + admin + guest + E2E in <60 min):** see [atlas-e2e/docs/operations/runbooks/local-dev-setup.md](../atlas-e2e/docs/operations/runbooks/local-dev-setup.md). This guide covers **guest-portal–only** onboarding (~5 min to dev server).

## 0–5 Minutes: Environment Setup

1. **Prerequisites** – Node.js **22.13.0+** (see `.nvmrc`/`.node-version`) and npm 10.9.2+.
2. **Install & start**
    ```bash
    npm ci
    npm run dev
    ```
    App binds to http://localhost:5173 by default (use `npm run dev -- --port 5174` if 5173 is taken / to align with atlas-e2e ports). No API clone or SQL required for static UI work.
3. **Configure environment variables** *(only when you need forms, maps, or live API)*
    ```bash
    cp .env.example .env
    ```
    Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, EmailJS, or `VITE_API_BASE_URL` as needed. Runtime `API_BASE_URL` is served via Cloudflare Functions `/.well-known/atlas-runtime-config.json` — local `wrangler pages dev` inject is handled by `atlas-e2e/scripts/start-servers.ps1` when running the full stack. Do not commit `.env`.

> **Portal-only shortcut:** If you touch only guest UI (themes, marketing, static pages), skip `atlas-api`, LocalDB, and the release gate. `npm ci && npm run dev` is the complete onboarding.

## 5–10 Minutes: Smoke Check (optional — CI does this)

1. **Open the app** – Visit http://localhost:5173, verify Home → Apartments → Location → FAQs → Contact navigation and the `/#our-homes` scroll CTA.
2. **Run tests if you changed logic** – `npm test` (Vitest) or `npm run lint`/`npm run build` as needed. Pre-push hooks and CI enforce lint/build; no manual gate required during onboarding.

## Explore the Codebase (at your pace — not gating)

- Routing: `src/App.tsx` (central route table) + `src/pages/home/Home.tsx` (hero, locations, testimonials).
- Data: `src/data.ts` / `src/data/listings.ts` (property inventory, featured flags).
- Config: `src/config/contact.ts` (phone/WhatsApp), `src/config/pricing.config.ts` (client-side fallback pricing).
- Docs: `docs/design-system.md`, `docs/short-links.md`, `AGENTS.md`.

## First Contribution

See `CONTRIBUTING.md` (branch from `dev`, `npm ci && npm run lint && npm run build && npm test`) and `docs/README.md` for the doc map. No `docs/first-pr.md` — start with any `good-first-issue` or docs fix.
