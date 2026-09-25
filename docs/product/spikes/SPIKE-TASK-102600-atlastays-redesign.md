# SPIKE: Atlastays Guest Portal Redesign — Visual Match to Reference Mockup

**Status:** 🧪 SPIKE / PROTOTYPE — local branch only (`spike/atlastays-redesign`), not pushed, not gated. For design review; a follow-on implementation task should be filed if the direction is approved.

**TASK-102600** | Investigator: Claude | Date: 2026-09-25

## Goal

Restyle the guest-facing site to closely match `docs/product/spikes/assets/atlastays-redesign-reference.webp` — a full-page mockup of atlastays.com: warm peach/terracotta gradient, serif "ATLAS HOMES" wordmark, pill-shaped search bar, icon-pill secondary filter row, 4-column property card grid, pill "Load more", and a footer with an email signup box plus contact/link columns — while reusing the site's real data/APIs and copy throughout (the mockup's sample property names/prices/"27 properties found" are illustrative only, not hardcoded).

## Starting point: the design system was already most of the way there

Before changing anything, I read through `src/styles/themes/{base,default}.css`, `src/styles/theme.ts`, and `src/index.css`'s Tailwind `@theme` block. The `default` color preset (`default.css`) is explicitly documented as the **"Gaurav Website visual language"** — a 10-color peach/apricot/blush/mauve/lavender/coral/maroon/ivory palette — and `base.css` already defines `--radius-pill: 50px`, applies pill radius to every `button`/`.cta-primary`/`.cta-secondary`, and `--radius-lg: 1.25rem` to every `.card`/`.panel`/`.hero-form`. Tailwind v4's `@theme` block wires `rounded-lg`, `rounded-pill`, `bg-cta-primary`, etc. straight to those CSS variables, so the vast majority of the app was already rendering in a close approximation of the reference mockup's palette and shapes — this is *not* a green-field reskin.

Browsing the running app before touching code confirmed this: the home page hero, the `/search` results page, a property detail page, checkout (`/reserve`), and the account pages (`/profile`, `/my-bookings`) all already showed the warm gradient hero, pill inputs, coral CTA buttons, and rounded cards. The remaining gaps versus the reference were structural/layout, not palette:

- Search-results grid capped at 2 columns (mockup shows 4 on desktop).
- No save/heart affordance on listing cards.
- Navbar search pill had no search icon.
- Footer had no "Get exclusive offers" email box (mockup's 6-zone footer: blurb, Quick Links, More, Help, email signup, Contact Us — the app only had 5, and the last column was labelled "Locate Us").
- `MarketplaceHomepage.tsx` (a secondary, currently-unrouted-in-this-env multi-tenant surface) still used hardcoded black/gray-100 Tailwind utility buttons that clashed with the rest of the site.

## What changed, by page/component

- **`src/components/apartments/ListingCard.tsx`** (search/apartments grid card, used by `Apartments.tsx` and elsewhere): added a heart/save toggle overlay on the card image (reuses the existing `src/utils/guestHistory.ts` `toggleFavorite`/`isFavorite` — the same localStorage-backed favorites store the navbar's "Saved" badge and `/favorites` page already read), rounded the image's top corners, and renamed the CTA from "View room" to "View home" (+ a trailing arrow) to match the mockup's button copy exactly.
- **`src/pages/SearchPage.tsx`** + **`src/pages/search-page.css`** (the actual "browse all homes" results grid — this is the page that behaves like the mockup's card-grid screen): widened the shell to `1440px` and stepped `.search-results-grid` from 2 → 3 → 4 columns at `901px`/`1280px` breakpoints (mockup is a 4-up grid on desktop), added the same heart/save button to each card's image, bumped card radius from `1rem` to `1.5rem`. Left the filter panel's functionality, `data-testid`s, and DOM structure untouched — only restyled existing rows to be pill/rounded (they already were largely pill-shaped going in).
- **`src/components/commonComponents/navbar/Navbar.tsx`** + **`navbar.css`**: added a circular coral search-icon button inside the desktop "Where to?" pill (was text-only), matching the mockup's pill-with-icon search bar.
- **`src/components/commonComponents/footer/Footer.tsx`**: added a "Get exclusive offers" email-capture box (pill input + circular arrow submit button) between "Help" and the renamed "Contact Us" column (was "Locate Us"), and widened the footer grid from 5 to 6 columns on large screens. See **Judgment call: footer email signup** below.
- **`src/pages/MarketplaceHomepage.tsx`**: lighter consistency pass — wrapped the hero (wordmark + trust strip + `AirbnbSearchBar`) in the shared `--gradient-hero` band, converted the category/List-Map/price filter controls from black/`gray-100` Tailwind defaults to the site's coral pill tokens, widened the card grid to 4 columns (`xl:grid-cols-4`), restyled the "View home" and "Show more homes" → "Load more" buttons to the coral pill CTA. See **Judgment call: MarketplaceHomepage scope** below.

Everything else (property detail — `Homepage_PropertyDetails.tsx` — checkout/`GuestDetailsPage.tsx`, `Reserve.tsx`, account pages, FAQ, legal pages) was left as-is after visual review: they already consume the same `--cta-primary`/`--bg-surface`/`--radius-*` tokens as the pages above, so they already read as part of the same warm, pill-shaped, rounded-card visual language. No hardcoded off-palette colors were found on these pages during review.

## Judgment calls (mockup didn't specify)

1. **Footer email signup has no backend.** I grepped the repo for `newsletter`/`subscribe` and found no subscription API. Rather than wire a fake network call, the form is intentionally front-end-only: it validates and shows an inline "Thanks — you're on the list!" confirmation, and does not persist anywhere. This should be swapped for a real endpoint (or removed) before this becomes anything other than a visual prototype.
2. **"Locate Us" → "Contact Us".** Copy-only rename of the footer's last column to match the mockup's heading exactly; the content (address/email/phone/WhatsApp rows) is unchanged.
3. **"View room" → "View home" (`ListingCard.tsx`).** The mockup's card CTA reads "View home" and `SearchPage.tsx`'s equivalent card already said "View {unitNoun.singular}" (→ "View home" for the Atlas tenant by default). Renamed `ListingCard.tsx`'s hardcoded string to match for consistency between the two card components guests may see.
4. **`MarketplaceHomepage.tsx` scope.** This route only renders when `isMarketplaceMode()` is true (set from `main.tsx`/`tenantContext.ts` based on a marketplace hostname or `effectiveThemeId`), which is **not** the active path in this local dev environment (the `atlas` tenant renders the classic `Home.tsx`/`SearchPage.tsx` pages, which already are "Atlastays" — the brand name shown throughout). I restyled it for token/shape consistency (see above) since it's still part of "the whole site," but did not chase deeper structural changes there and could not screenshot-verify it live without forcing marketplace mode globally, which felt like a bigger, riskier change than this spike's scope. Flagging as an open question: should a future pass verify `MarketplaceHomepage.tsx` visually once marketplace mode is reachable, or is `Home.tsx`/`SearchPage.tsx` the actual production surface this mockup should be judged against?
5. **Checkout/auth pages the mockup doesn't depict.** The mockup only shows the search/browse screen. For checkout (`GuestDetailsPage.tsx`, `Reserve.tsx`), account (`ProfilePage.tsx`, `MyBookingsPage.tsx`, `GuestLoginPage.tsx`), FAQ, and legal pages, I treated "match the design language" as: keep every existing rounded-pill/coral-CTA/warm-card treatment (they already had it) rather than introduce new mockup-specific motifs (like the property-card carousel arrows or availability badges) that don't apply to those page types. No changes were needed there beyond what the shared tokens already provide.
6. **No real per-listing photo carousel.** The mockup's cards show hover arrows implying multiple photos per listing. `ListingCard`/`SearchPage`'s normalized listing types only carry a single `imageUrl`/`image` today; adding a carousel would mean plumbing `property_img[]` through several data-shaping layers (`Apartments.tsx`, `SearchPage.tsx`'s `NormalizedListing`, `MarketplaceHomepage.tsx`'s `MarketplaceItem`). Out of scope for this visual spike — flagged as a possible follow-up rather than faked with placeholder multi-image data.

## Verification

- `npm install` (Node v24.19.0, satisfies the `>=22.13.0` engine requirement).
- `npm run dev` on port 5174 (the port `vite.config.ts` pins for this repo); browsed with the Chrome preview tool.
- Local-only: to render property detail / checkout pages without the .NET backend running, I temporarily set `apiBaseUrl` to `""` in `public/.well-known/atlas-runtime-config.json` so the app's existing mock-data fallback path (`MOCK_API_SETUP.md`) kicked in. **This file is reverted back to `http://127.0.0.1:5120` before the final commit** — it's a real, tracked config file, not a throwaway.
- Verified against the reference image at desktop (1440×900) and mobile (375×812) widths:
  - **Home (`/`)** — gradient hero, pill search widget, "Book Now" CTA, trust-badge row: already matched closely; no changes needed.
  - **Search results (`/search`)** — filter bar, 4-column card grid (was 2), heart/save toggle, "Load more" pill button, footer with new email-signup column. Confirmed the heart toggle updates the navbar's "Saved" badge live (shared `atlas-favorites-changed` event).
  - **Property detail (`/homes/room-101/1`)** — gallery, host card, "What 'verified' means" callout, booking widget, cancellation timeline: already matched closely; no changes needed.
  - **Checkout (`/reserve`)** — 4-step pill progress indicator, review card: already matched closely; no changes needed.
  - **Account (`/profile`, `/my-bookings`)** — empty/unauthenticated states with pill CTAs and the same trust-icon row: already matched closely; no changes needed.
  - Mobile (375px): navbar collapses to the existing `MobileSearchPill`, search grid drops to 1 column with full-width cards, footer stacks to a single column including the new email box — all confirmed via screenshot.
- `npm run typecheck` — **clean, 0 errors.**
- `npm run lint` — **0 errors, 26 warnings**, all pre-existing (`react-refresh/only-export-components`, a few `react-hooks/exhaustive-deps`) in files this spike didn't touch or in lines unrelated to these edits; nothing introduced by this change set.
- Did **not** run `npm run test:gate` / e2e — explicitly out of scope for this spike per instructions.

## Open questions for design review

- Is `Home.tsx` + `SearchPage.tsx` (the "classic" layout, which already renders under the "Atlastays" brand for the `atlas` tenant) the correct production target for this mockup, or was `MarketplaceHomepage.tsx` intended? They're two different code paths gated by `isMarketplaceMode()`.
- Should the footer's "Get exclusive offers" box be wired to a real subscription endpoint, or dropped, before this leaves prototype status?
- Is a real multi-photo carousel on listing cards worth the data-plumbing to fully match the mockup's hover-arrow affordance, or is a single hero image per card acceptable long-term?
