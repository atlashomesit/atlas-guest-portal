# SPIKE-4602: Prerender/SSR Options for Client-Side-Only Meta/JSON-LD (ADR-0018 Revisit)

**Date:** 2026-07-09  
**Context:** TASK-4602 — Guest portal metadata (title, description, canonical, JSON-LD) is injected client-side via useEffect; JS-blind crawlers see fallback tags only. Spike to re-evaluate fix options post-ADR-0018.  
**Objective:** Measure crawler impact, quantify cost/effort per option, recommend whether to reverse ADR-0018's deferred decision.

---

## Problem Summary

`atlas-guest-portal` is a Vite-built React SPA deployed as static HTML on Cloudflare Pages. All metadata injection (og:title, og:description, JSON-LD for listing/city pages) happens post-JS via `SEO.tsx` and per-page components like `HomeDetails.tsx`. 

**Consequence for crawlers:**
- **JS-enabled crawlers** (Googlebot, modern Bingbot, Yandex): See correct, tenant-specific metadata after JS executes (1–3s delay).
- **JS-blind crawlers** (older web indexers, social media unfurlers, email preview clients): Receive static fallback values from `index.html` only — generic Atlas branding, no page-specific title/description/image.
- **LCP/SEO impact:** 1–3s JS delay before metadata is known affects crawl scoring (Largest Contentful Paint timing).

**Current ADR-0018 stance:** Runtime DOM rewrite (Option 3) was chosen as a cost-justified interim solution. Defer SSR (Option 1) and Cloudflare Workers (Option 2) until white-label tenant social-advertising demand or scale justifies the cost.

---

## Crawler Impact Analysis

### Search Engine Crawlers (Google, Bing)
- **Google:** Renders JS; sees correct JSON-LD + og:tags after 1–3s JS delay. **Impact: NONE** — correct metadata is indexed.
- **Bing:** Modern crawler, also renders JS. **Impact: NONE** — same as Google.
- **Yandex:** Renders JS. **Impact: NONE**.
- **DuckDuckGo:** Relies on Bing's index. **Impact: NONE**.

**Verdict:** Major search engines see correct metadata → **No ranking disadvantage for pre-JS crawlers.**

### Social Media Unfurlers (WhatsApp, Telegram, Slack, iMessage, Discord)
- **WhatsApp/Telegram/iMessage:** **JS-blind.** Fetch HTML, parse static `<meta>` tags only. See:
  - `og:title="Atlas Homestays"` (generic fallback)
  - `og:description="Find your perfect stay..."` (generic)
  - `og:image=/og-image.svg` (Atlas placeholder)
  - Result: Link preview shows generic Atlas branding, not listing-specific title/image.
- **Slack/Discord:** Some can render JS, but timeout aggressively (< 2s); usually fall back to static tags.

**Current impact:** Link preview for `starguesthouse.atlastays.com/homes/bungalow/1` shows "Atlas Homestays" instead of "Luxury Bungalow — 3 Bedrooms". On competitor white-label sites, this is a brand-leak risk (acceptable per ADR-0018 amendment, low social-ad volume).

**Verdict:** Social unfurlers see generic metadata → **No SEO ranking impact, but poor social preview experience.**

### Email Clients (Gmail, Outlook, Apple Mail)
- **Gmail:** No preview fetching for links. **Impact: NONE**.
- **Outlook/Apple Mail:** Fetch initial HTML only, no JS rendering. See static fallback tags.

**Verdict:** Email previews would see generic metadata; rarely used for travel booking links.

---

## Option Evaluation Post-ADR-0018

### Option (a): Build-Time Static Meta Generation

**Approach:**  
At build time (Vite pre-render plugin or custom script), generate pre-rendered `.html` files for high-traffic pages:
- Listing pages: `GET /api/listings/{id}` → extract title, description, images, JSON-LD schema → render to `dist/homes/{slug}/{unit-slug}.html`
- City/region pages: `GET /api/cities/{city}` → render to `dist/explore/{city-slug}.html`
- Home page: `dist/index.html` (one static file)

Build output: Multiple `.html` files (one per listing), routed by Cloudflare Pages `_routes.json` to map `/homes/property/unit` → `homes/property/unit.html`.

**Pros:**
- ✅ Zero runtime overhead (no JS, no API call on page load)
- ✅ Social unfurlers see correct metadata immediately (no 3s JS delay)
- ✅ Perfect SEO: crawlers receive complete metadata in initial HTML response
- ✅ Fastest LCP: no JS render block
- ✅ Uses existing static deployment model (no SSR server needed)
- ✅ Works for both white-label and marketplace

**Cons:**
- ⚠️ **Build-time data lock:** Metadata is baked at build time. Updates to listing title/image require a rebuild + redeploy (30–45min cycle with CI)
- ⚠️ **File explosion:** Atlas ships ~200 listings × 3 white-label tenants = 600 `.html` files; future growth to 1000 listings = 3000 files
- ⚠️ **API rate limits:** Build process makes 600+ API calls to seed metadata (requires endpoint, auth headers, batching logic)
- ⚠️ **Stale data risk:** Listing name changed at 14:00 UTC; site redeployed at 14:50 UTC with wrong title cached; user sees old title for 24h+ (Cloudflare cache TTL)
- ⚠️ **Incremental builds are hard:** Must track which listings changed since last build to avoid regenerating all 600 files
- ⚠️ **Dynamic content breaks:** Promo pricing, availability counts, review aggregates that change hourly cannot be baked into static HTML

**Effort:** 2–3 dev-days (Vite pre-render plugin + API integration + Cloudflare Pages routing config + test data seed)

**Monthly Cost:** $0 (uses existing Cloudflare Pages + storage)

**Data freshness:** 30–45min behind live (rebuild cycle)

---

### Option (b): Cloudflare Worker HTMLRewriter (Reverse ADR-0018 Option 2)

**Approach:**  
Deploy a Cloudflare Pages Function (`functions/_middleware.ts` or `functions/homes/[...].ts`) that:
1. On request to `/homes/{slug}/{unit-slug}`, intercepts the HTML response
2. Calls `GET /api/listings/{id}` at the edge (via Cloudflare Workers cache-first fetch)
3. Uses HTMLRewriter to inject `<meta og:title>`, `<meta og:description>`, `<script type="application/ld+json">` based on the API response
4. Returns rewritten HTML to the browser

**Pros:**
- ✅ Pre-JS metadata rewrite (social unfurlers see correct values immediately)
- ✅ Data freshness: API is called fresh on each page load (or served from Cloudflare cache if TTL set)
- ✅ No static file explosion (single `index.html` shell + function logic)
- ✅ Scales to unlimited listings without build-time overhead
- ✅ Supports dynamic content (pricing, availability, new reviews)
- ✅ Works for both marketplace and white-label

**Cons:**
- ⚠️ **Cloudflare Pages Function cost:** Functions have generous free tier (100k invocations/day), but at 10k daily unique users, could hit limits during high traffic → need Function pricing plan (~$0.50/million invocations or $5/month minimum plan)
- ⚠️ **Cold-start latency:** First request to `/homes/property/unit` triggers an API call at the edge; typical response time 150–500ms. Adds 150–500ms to TTFB (Time To First Byte) on cache misses
- ⚠️ **API dependency:** If `/api/listings/{id}` is slow or down, the page load is blocked; no fallback to stale cache (must implement exponential backoff + fallback logic)
- ⚠️ **Operational complexity:** Functions are stateless; must manage error handling, cache invalidation, cache keys, and circuit breakers for API timeouts
- ⚠️ **Requires new infrastructure:** New Cloudflare Functions configuration; must be tested and monitored separately from SPA deployments
- ⚠️ **Testing complexity:** E2E tests must mock the Worker or run against live API edge

**Effort:** 2–3 dev-days (Worker code + cache strategy + error handling + tests + Cloudflare config)

**Monthly Cost:** ~$0–5 (functions free tier covers 100k invocations/day; only pay if sustained load exceeds 280k/day at $0.50/M)

**Data freshness:** On-demand, bounded by Cloudflare cache TTL (suggest 1h for listings, 5min for reviews)

---

### Option (c): Full SSR (Reverse ADR-0018 Option 1)

**Approach:**  
Migrate `atlas-guest-portal` from static SPA to SSR framework (Astro, Remix, Next.js). On request to `/homes/{slug}/{unit-slug}`:
1. Server renders the full page with listing-specific metadata baked into HTML
2. Returns pre-rendered HTML to the browser
3. Client-side React hydrates and takes over for interactivity

**Pros:**
- ✅ Strongest guarantee: all metadata in initial HTML response, no JS dependency, perfect for all crawlers
- ✅ Zero cold-start latency: HTML is generated by a stateful server process, not edge functions
- ✅ Can be optimized for LCP: metadata in `<head>`, above-the-fold images lazy-loaded
- ✅ Simplifies data fetching: single source of truth for listing data (server-side, not split between client and API)

**Cons:**
- ❌ **Fundamental architecture change:** Requires migrating from Vite SPA to an SSR framework; rewrites ~60% of the codebase
- ❌ **New deployment model:** Cloudflare Pages static deployment no longer works; must deploy to a Node.js server (Vercel, Railway, Azure App Service, self-hosted) with auto-scaling, monitoring, logs
- ❌ **Cost explosion:** Vercel/Railway = $20–200/month depending on scale; self-hosted Node server = compute infrastructure
- ❌ **DevOps overhead:** Manage database connection pooling, cache invalidation, server monitoring, error tracking separate from the SPA
- ❌ **Dev/prod parity:** Local development requires running a Node server, not just `npm run dev`; slower feedback loop
- ❌ **Slow migration timeline:** 3–4 weeks for a solo dev (rewrite pages, migrate state management, integrate SSR, test E2E)
- ❌ **Risk:** Breaking change to entire deployment pipeline; rollback is complex

**Effort:** 3–4 weeks (full rewrite) + 1 week integration/testing + 1 week for DevOps setup

**Monthly Cost:** $50–200/month (depending on server choice and scale)

**Data freshness:** On-demand, real-time (same as Option b, but with server-side rendering)

---

## Recommendation

**→ Defer all options for now. Accept the current ADR-0018 interim solution.**

**Rationale:**

1. **Search engines unaffected:** Google, Bing, Yandex all render JS and see correct metadata. No ranking disadvantage.
2. **Social preview UX acceptable:** Link previews show "Atlas Homestays" instead of listing title. This is low-friction for current traffic (white-label social ads are minimal; marketplace users are internal only).
3. **Cost-benefit unfavorable at current scale:**
   - Option (a) build-time generation: 2–3 days dev, but requires 30–45min rebuild cycles + adds stale-data risk to cached pages + file explosion (600+ HTML files)
   - Option (b) Cloudflare Workers: 2–3 days dev + $0–5/month, but adds 150–500ms cold-start latency on first page load (hurts LCP metrics)
   - Option (c) SSR: 3–4 weeks + $50–200/month, massive architectural change for marginal social-preview improvement

4. **Future demand signal:** Revisit when:
   - White-label tenants launch paid social campaigns requiring correct og:image / og:title in link previews (estimated: Q4 2026)
   - Monthly traffic exceeds 50k DAU, making pre-JS crawling important for SEO (estimated: Q3 2026)
   - Listing inventory grows to 500+ units, making build-time generation infeasible
   - Founder explicitly requests social-preview correctness over dev-time cost

---

## If Forced to Recommend (Priority Order)

**If social preview correctness is suddenly critical (paid ads launch):**
→ **Option (b): Cloudflare Worker HTMLRewriter** — minimal deployment change, pre-JS metadata, reasonable cost at current scale.

**If build-time generation is preferred (no runtime API dependency):**
→ **Option (a): Build-time static meta generation** — zero runtime cost, but accept 30–45min stale-data window and 600+ static HTML files.

**If a full rewrite is justified by other factors (other framework migration, server side needed for features):**
→ **Option (c): SSR** — best UX/SEO outcome, but not justified by SEO/social-preview alone.

---

## Constraints & Gotchas

### Option (a) - Build-Time Generation Gotchas
- **API rate limits:** Seeding 600 listings at build time requires batched API requests; protect with timeout + retry logic
- **Deployment cycle:** Every listing change requires a redeploy (30–45 min). Consider separating listing updates from static site CI/CD
- **Cloudflare cache:** Pages cached for 30+ days; metadata changes won't be reflected until purge or TTL expires
- **Incremental builds:** Without care, every build regenerates all 600 HTML files (slow CI). Implement change tracking or use partial builds

### Option (b) - Cloudflare Worker Gotchas
- **Cold-start latency:** First request after Function version update or Cloudflare edge cache miss adds 150–500ms. Monitor with Web Vitals
- **API timeout:** If `/api/listings/{id}` times out (> 10s), the entire page load stalls. Must implement fallback (serve SPA shell, let JS fetch metadata)
- **Cache invalidation:** Listing title changes; Worker cache must be purged within 5 min or TTL respected. Implement Cloudflare API call on listing update
- **Testing:** E2E tests must either mock the Worker or run against live APIs; harder to reproduce cache misses locally

### Option (c) - SSR Gotchas
- **Server-side state management:** Migrating Redux/Zustand to server requires careful data passing to React hydration
- **Database connection pooling:** Node.js server needs connection pool; migration from client-only to server changes data flow entirely
- **Monitoring:** New error surface (server errors vs. client errors); must set up separate APM (Application Performance Monitoring)

---

## Cost Summary Table

| Option | Social Preview UX | Search Rankings | Build Cycle | Monthly Cost | Dev Effort | Recommendation |
|--------|-------------------|-----------------|-------------|--------------|-----------|-----------------|
| Current (ADR-0018) | Generic fallback | ✅ Correct (JS crawlers) | None | $0 | Ongoing | ✅ **HOLD** |
| (a) Build-time static | ✅ Correct | ✅ Correct | 30–45 min | $0 | 2–3 days | Option if time < cost |
| (b) Cloudflare Worker | ✅ Correct | ✅ Correct (1st response) | None | $0–5 | 2–3 days | Option if social ads launch |
| (c) Full SSR | ✅ Correct | ✅ Correct | None | $50–200 | 3–4 weeks | Not justified now |

---

## Next Steps (Deferred)

1. **If white-label social ads launch (signal: founder says "fix social previews"):**
   - Implement Option (b) Cloudflare Worker + test social unfurler correctness
   - Add Web Vitals monitoring to catch cold-start latency regressions
   - Set up cache invalidation trigger on listing updates

2. **If monthly traffic exceeds 50k DAU and social previews become critical:**
   - Re-evaluate cost-benefit; Options (a) and (b) both become more attractive
   - Consider incremental rollout: implement Worker for top 50 listings (high traffic) first

3. **Long-term (6–12 months):**
   - If listing inventory grows to 500+, build-time generation becomes impractical; Worker is then the only viable interim step before SSR
   - Monitor Googlebot's JS rendering latency; if LCP is consistently > 3s, SSR may become justified for ranking

---

**Approval required:** Founder confirmation that deferral is acceptable. Next implementation task will be filed only if founder requests social-preview correctness.

**Spike completion:** Investigation complete. Memo returned to founder for direction on ADR-0018 revisit.
