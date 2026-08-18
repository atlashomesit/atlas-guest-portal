# DESIGN-026 — Persistent Mobile Search Affordance

**Status:** Implementation ready  
**Surface:** `atlas-guest-portal` — mobile-first (~90% of guest traffic)  
**Related:** TASK-7088 (already shipped; no conflict)

---

## Design Decisions

### 1. Resting Form → Compact Header Pill

A "Where to?" pill sits **between the logo and hamburger button** in the existing mobile header bar.

- **Why not bottom nav?** The guest portal has no bottom nav today. Adding one is a large architectural change that affects every screen. A header pill extends the existing desktop search-pill pattern to mobile — consistent visual language, minimal surface-area change. Airbnb's mobile web uses a header search bar for the same reason.
- **Why not sticky-on-scroll?** The navbar is already `position: fixed`. The pill lives in it and scrolls with it. No additional scroll-watching needed.

The pill uses the same design tokens as the desktop `.navbar-search-pill` (border, background, brand-primary icon), scaled to fit the mobile header row at ≥320px.

### 2. Expanded State → Full-Screen Overlay, Dates-Optional

Tapping the pill opens a **full-screen modal overlay** with progressive disclosure:

1. **Destination** (auto-focused) — shows recent searches + popular destinations, with typeahead filtering. Reuses `destinationData.ts` and `recentSearches.ts` from the AirbnbSearchBar.
2. **Dates** (optional accordion) — "I'm flexible" default. Atlas is a homestay portal; guests browse without fixed travel dates. Dates can be set on the results page.
3. **Guests** (optional accordion) — "Add guests" default. Can be set on the results page.

The overlay body scrolls independently (`overflow-y: auto; overscroll-behavior: contain`) so the focused input stays visible when the virtual keyboard opens.

### 3. Book Now Coexistence → No Conflict

| Surface | Primary CTA | Book Now |
|---|---|---|
| Non-property pages (home, /search, etc.) | **Search pill** (navigates to /search) | In hamburger menu (also → /search) |
| Property detail pages | **Search pill** (still visible for re-search) | In hamburger menu (scrolls to in-page booking form) |

**There are no two competing primaries.** On non-property pages, the search pill and Book Now both lead to `/search` — the pill is the visible one. On property detail pages, the in-page booking form is the conversion path; Book Now scrolls to it; the search pill enables re-searching.

`handleBookNow` is **completely untouched** — its scroll-to-form / navigate-to-search behavior remains identical.

### 4. Keyboard Avoidance + Safe Area

- Overlay: `position: fixed; inset: 0`
- Notch/home-indicator: `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`
- Keyboard: body scroll locked (`overflow: hidden`); overlay body is the scroll container — the browser scrolls the focused input into view within the overlay's scrollable area.
- Escape key closes overlay.

### 5. Bottom-Nav Proposal → Not Proposed

A bottom nav is **not recommended** for the guest portal at this time. The portal has 4-5 navigation destinations and a single primary flow (search → property → book). A bottom nav would:
- Add visual weight to every page for marginal navigation benefit
- Require designating 4-5 tab items (Search, Stays, Saved, Trips, Profile?) — but "Stays" and "Search" overlap
- Compete with the in-page booking form's sticky footer on property pages

If bottom nav is desired later, the search pill would move into it as the center tab.

---

## Files Changed

| File | Change |
|---|---|
| `Navbar.tsx` | Import `MobileSearchPill` + CSS; place pill between logo and hamburger |
| `MobileSearchPill.tsx` | **New.** Compact pill button + state to open/close overlay |
| `MobileSearchOverlay.tsx` | **New.** Full-screen search overlay with destination/dates/guests |
| `mobile-search.css` | **New.** All mobile search styles (pill, overlay, sections, suggestions, footer) |
| `Navbar.test.tsx` | 4 new tests: pill renders, overlay opens/closes, search navigates, handleBookNow not regressed |

### What is NOT changed
- `handleBookNow` — zero modifications
- Desktop search pill (`hidden lg:flex` Link to /search) — untouched
- Saved badge + account menu — fully reachable (hamburger unchanged)
- Navigation config (`navigation.ts`) — untouched
- `navbar.css` — no modifications

---

## Touch Targets & 320px Safety

- Mobile search pill: `min-height: 44px`, full-width flex within header row
- Overlay close button: `44×44px`
- Suggestion rows: `min-height: 44px`
- Search CTA button: `min-height: 48px`
- At 320px: pill margins and padding reduce; overlay body padding tightens
- No horizontal overflow at any width ≥320px

---

## Deferred Notes

1. **Date picker integration** — the dates accordion currently shows a "flexible" placeholder. Full `AtlasDateRangePicker` integration deferred to a follow-up (the picker exists in `SearchAvailabilityWidget` and `AirbnbSearchBar` and can be lazy-loaded into the overlay).
2. **Guest selector integration** — same pattern; `AirbnbGuestSelector` can be imported into the guests accordion.
3. **Search-by-image** — the `SearchByImageModal` could be triggered from the overlay (e.g., camera icon in the destination input). Deferred.
4. **Scroll-hide header** — if a scroll-to-hide header is added in future, the search pill moves with it. No special handling needed now.
5. **Bottom-nav** — see §5 above. If reconsidered, the pill moves to a center tab.

---

## Design System Tokens Used

All styles use existing guest-portal design tokens:
- `--bg-primary`, `--bg-card`, `--bg-muted`, `--bg-surface`
- `--text-primary`, `--text-muted`
- `--brand-primary`, `--brand-accent`
- `--border-subtle`
- `--gradient-cta`
- `--navbar-search-pill-bg`, `--navbar-search-pill-border`
- `--radius-pill`, `--radius-md`, `--radius-lg`
- `--font-family-base`, `--font-family-display`
- `--z-modal`
- `--safe-area-top` (via `env(safe-area-inset-top)`)
