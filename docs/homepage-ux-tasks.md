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

## Rollout flags per section (5–8)
- Secondary banner: `enableSecondaryBannerRemoved`, `enableSecondaryBannerValueBlock`, `enableSecondaryBannerImprovedOverlay`.
- Services: `enableServicesConcreteCopy`, `enableServicesIconography`, `enableServicesOneLineDescriptions`, `enableServicesAlternatingBackgrounds`.
- Why Choose: `enableWhyChooseConciseBullets`, `enableWhyChooseStatsBadges`, `enableWhyChooseNoSelectionState`, `enableWhyChooseAccordion`.
- Testimonials: `enableTestimonialsStatic3`, `enableTestimonialsSingleCentered`.
- Footer mini CTA: `enableFooterMiniCtaAboveFooter`.
