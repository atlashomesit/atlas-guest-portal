# Guest portal design contract

Established 2026-10-11 from the founder's guest date-selection review and existing theme contracts.

## Purpose and identity

Help guests find an appropriate property, understand the stay and book confidently on a phone. Preserve the tenant's brand, property photography and configurable contact information. Atlas PMS platform identity, Atlas Homestays tenant identity and Atlastays marketplace identity are distinct.

Use [design system](docs/design-system.md), `src/styles/themes/`, `src/styles/theme.ts` and the current theme registry. Support existing classic, heritage, noir, coastal, editorial and photoFirst layouts and tenant palette presets. Do not impose admin-blue chrome across tenant sites. Missing assets need honest fallbacks, never invented property photos or reviews.

## Protected patterns

- Follow AGENTS.md's theme/integration boundary. Theme changes must not alter shared booking/payment/hold logic, tenant resolution, entitlement rules or API clients. Tenant-variable content comes from configuration, not new tenant-specific conditionals.
- Review BOTH the property booking date picker and the search date picker. Each has its own directly linked before/after comparison, including desktop and phone.
- Preserve civil dates and the existing IST today boundary; no accidental UTC-day shift. Check disabled dates, min/max, cross-month ranges, checkout after check-in, availability, guest counts, totals and URL/query state.
- Keep price breakdowns, fees/tax/policy disclosures, payment/hold errors and booking confirmation details visible in their correct step. Cosmetic work cannot change money, inventory or hold semantics.
- Calendars keep clear arrival/departure/selected-range states and keyboard/focus behavior. Avoid giant controls that push useful dates or the booking summary out of view.
- Keep tenant logo/name/photos/contact and supported theme distinctions. Existing customer data must not become synthetic content in production.
- Sticky booking actions respect safe areas, consent banners and modal layering; labels and error messages remain readable on small screens.

## Evidence precedence

The current session's approved guest property and search picker direction is in private `docs/ux/booking-date-pickers-2026-10-11/guest-comparisons.html`. Keep the source proposal immutable and inspect the linked actual captures plus code before extending it. Approval of one picker does not imply unshown changes to the other or the payment flow.

## Review and change contract

Read this file before UI changes. Existing source code and domain contracts remain authoritative for calculations, permissions and transitions; this document records design intent. Latest explicit founder-approved evidence wins for its specific scope. Record dated supersession; never edit an approved mockup to disguise implementation drift.

Preserve useful features, meaningful colours, real imagery, role/eligibility rules, filters, exports and accessible names. Improve hierarchy, spacing and density without reducing the product's capabilities. An approved menu may group secondary actions, but errors/drafts/warnings remain discoverable and routine work must not gain undisclosed extra steps.

Compare the same route, role, synthetic fixture, state/tab and viewport. Capture the first viewport and full page at 393×727 and 1280×720; check 1920×1080, 3440×1440, keyboard/touch and 200% zoom. Use available width for operational work and constrain reading/form sections locally. Preserve touch targets while making dense desktop controls visually compact.

For the daily five-screen lane, use `atlas-daily-ux-five` (canonical source: `atlas-e2e/skills/atlas-daily-ux-five/SKILL.md`). Each atomic approved change needs its own implementation and review verdict; screen count is not change count. A separate UI/UX expert reviews proposals and actual implementation. Proposal approval authorizes its scoped implementation only. **Wait for Sreekar's final approval of the review bundle and exact PR HEADs before any merge to dev.** This lane overrides older merge-fast/keep-merging instructions. Keep pending PRs draft with auto-merge off; no direct push to dev, QA cut or deployment.

Keep dated screenshots, HTML comparisons, reviewer findings, approval records and coverage manifests in private `atlashomesit/atlas-ux-evidence`, locally `D:/AtlasWork/atlas-ux-evidence/docs/ux/`. No credentials/auth storage/customer PII in evidence; no image evidence in the public E2E repo. Update this file in the same PR when an approved decision changes, with the exact evidence revision and superseded rule.

## Approved daily review — 11 October 2026 r2

Sreekar explicitly approved three designs and their eight commitments in chat 01a12a08-bddf-7942-aa2a-2d6063ce2c7a. This portal implements UXD-2026-10-11-02-C01–C03: Group unchanged date/guest controls; disclose secondary filters without hiding selected chips/reset or warnings; results and List/Map/sort follow sooner. Existing tenant tokens, vertical cards and approved header/property date pickers remain unchanged.

Approved evidence: private atlas-ux-evidence/docs/ux/daily-five/2026-10-11/r2/index.html. Actual evidence: the same dated directory /implemented-r1/. This supersedes only the prior placement/presentation for the identified scope. Final approval of exact implementation PR heads is still required before merging. The shared contract above is copied unchanged from the pending setup PR; the setup PR remains separate and unmerged.

## Approved wide-screen correction — 12 October 2026

Immutable approval: private atlas-ux-evidence/docs/ux/wide-screen-review-2026-10-11/index.html at HEAD 78031d5993aa6b938b0de591127c2148ecefc6e5. Actual evidence: implemented-r1/ under that directory. This supersedes the prior universal vertical-card placement only for Search: compact horizontal cards at 1024–1599px expose a useful price/action before the 720px fold; larger desktops use three/four vertical result columns with locally bounded secondary filters. Phone disclosure, chips, date feedback, fees, source semantics and controls remain available. One-photo Property galleries use the full gallery with contained imagery and bring the booking panel beside it; zero/multiple-photo variants and booking eligibility remain intact. These changes retain the established tenant palette. Final review and exact-head approval remain required; pending setup #601 stays separately held.

## Daily five — 14 October 2026 implementation approval

Sreekar approved the immutable [2026-10-14/r1 proposal](https://github.com/atlashomesit/atlas-ux-evidence/blob/cc48056c8bdbbb3467ccfcc51f7753ec2ae6f9fa/docs/ux/daily-five/2026-10-14/r1/index.html): “I approve all 5 designs. Implement them keeping existing colors and useful features intact, then show me actual before and after for final approval before merging to dev.” Proposal source SHA256: 540623979b182a9aefb300f64442926a2cd3005f604120b2d9f3d4064842d68e.

FAQ UXD-2026-10-14-02-A/B/C: compact the route header/search hierarchy, use a phone topic disclosure with focus at the chosen answer, and filter preserved highlights together with category answers. A highlight-only search must not show a false no-result; no-topic content spans the content area. Preserve Terms precedence, all answers, legal links, tenant theme, native modified-link behavior and default navigation/layout on other legal routes. This supersedes only the FAQ spacing and phone topic placement.

Actual three-column comparisons and independent per-ID review live in private atlas-ux-evidence/docs/ux/daily-five/2026-10-14/implemented-r1. Implementation approval does not authorize merge. Hold the draft PR until Sreekar approves the actual result and exact final head; auto-merge remains off.
