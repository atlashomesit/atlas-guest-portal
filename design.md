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
