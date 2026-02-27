# Homepage UX tasks (Sections 5–8)

Use this checklist to coordinate experiments and ensure default behavior is preserved.

## Goal
Deliver toggleable UX experiments for homepage sections 5–8 while keeping current visuals as the default path.

## Current issue
No structured flags or placeholders exist for banner, services, why-choose, testimonials, or footer CTA variants.

## Proposed solution options
- Gate each experiment behind a boolean flag in `src/config/homepageUxFlags.ts` (all default to `false`).
- Wrap each section in a new component that keeps the current experience as the default render and exposes TODO placeholders for upcoming variants.

## Acceptance criteria
- Default renders match today’s UI when all flags are `false`.
- Each section has clearly named flags for variant paths and TODO placeholders for incomplete content.
- Home page imports the new wrappers and respects flag guards.
- Footer mini CTA renders only when explicitly enabled.

## Guest portal booking behaviors
- **Homepage uses search mode**: past dates are disabled, booked dates are not blocked, and the **Check availability** CTA opens the availability modal instead of a unit-specific booking flow.
- **Listing pages use unit mode**: booked dates are disabled per listing calendar and the only CTA is **Book this home**.
- New components: use `SearchAvailabilityWidget` for homepage availability checks and `UnitBookingWidget` for listing-level booking/availability flows.

## "Do not break" constraints
- Avoid visual regressions when flags are off.
- Do not change existing copy, imagery, or layout for default paths.
- Keep experimental placeholders visually lightweight (borders/dashed/neutral backgrounds).

## Implementation checklist
- [ ] Add/verify flags in `src/config/homepageUxFlags.ts` (all `false` by default).
- [ ] Wrap sections in new components under `src/components/home/` with default paths mirroring current UI.
- [ ] Add TODO placeholders and comments for unimplemented variants.
- [ ] Wire components into `src/pages/home/Home.tsx` with flag guards.
- [ ] Add footer mini CTA strip component and guard.
- [ ] Update docs (this file) with acceptance criteria and rollout notes.

## QA checklist
- [ ] Render Home with all flags `false` and confirm current banner, services, why-choose, and testimonials text appear.
- [ ] Sanity check that enabling each flag swaps to placeholder variants without crashing.
- [ ] Run lint/tests if applicable.

### Navigation + sitemap QA (routing cleanup)
- Apartments overview entry is removed from header/footer navigation; discovery now happens from the Home “Our Homes” section anchor.
- Visiting `/apartments` should redirect to `/#our-homes` without throwing an app error.
- Sitemap generation uses the current host (dev/prod) and excludes `/apartments`.

## Rollout flags per section (5–8)
- Secondary banner: `enableSecondaryBannerRemoved`, `enableSecondaryBannerValueBlock`, `enableSecondaryBannerImprovedOverlay`.
- Services: `enableServicesConcreteCopy`, `enableServicesIconography`, `enableServicesOneLineDescriptions`, `enableServicesAlternatingBackgrounds`.
- Why Choose: `enableWhyChooseConciseBullets`, `enableWhyChooseStatsBadges`, `enableWhyChooseNoSelectionState`, `enableWhyChooseAccordion`.
- Testimonials: `enableTestimonialsStatic3`, `enableTestimonialsSingleCentered`.
- Footer mini CTA: `enableFooterMiniCtaAboveFooter`.
