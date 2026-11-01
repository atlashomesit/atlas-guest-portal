# Guest portal design contract

## Daily ten — 17 October 2026 implementation approval

Sreekar said **“i approve”** while viewing the immutable [2026-10-17/r1 gallery](https://github.com/atlashomesit/atlas-ux-evidence/blob/df538417675db34dc2fb69bcecd6a1a95b2b1c74/docs/ux/daily-five/2026-10-17/r1/index.html). Binding approval: private evidence 2026-10-17/implemented-r1/APPROVAL.json. Prototype SHA256: e89d22a9a08658a0b94e4d6a8b4f832459cd5b2ee1659388259ae0e6695f7c97.

UXD-2026-10-17-04-A/B, 08-A/B and 10-A: compact Terms introduction with responsive native topic disclosure/focus; About section shortcuts and bounded reading layout; persistent Offers promo label and help association.

This supersedes only those disclosed presentation decisions. Existing colors, imagery, useful actions, permissions, financial/availability meanings and service handlers remain authoritative. Actual rendered fidelity, four viewport sizes and real 200% zoom require independent verification. Keep the PR DRAFT with hold-for-review and auto-merge off. Source/build checks do not authorize merge; Sreekar's separate final approval must identify actual evidence and exact heads.

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

## Daily five — 15 October 2026 implementation approval

Sreekar approved all ten proposals with “i approve”, after the five-workflow r1 review. Immutable proposal: [2026-10-15/r1](https://github.com/atlashomesit/atlas-ux-evidence/blob/838b91614aaca70ffd08bd551681b88780c410f9/docs/ux/daily-five/2026-10-15/r1/index.html). This portal implements UXD-2026-10-15-03-A/B and04-A/B. Policies compacts the intro/search hierarchy and uses a phone topic disclosure, retaining all eight destinations, legal text/date/Terms precedence, search and focus/hash behavior after no-results recovery. FAQ retains its existing default topic label. Contact puts the enquiry form beside the intro on desktop and immediately after it on phone, with a Send us a note focus link and compact contact actions. Name, Email, Phone, Destination and Message, tenant contact values, business/owner explanation, links and validation/submission behavior remain. Existing purple WhatsApp/orange Call and theme tokens are preserved.

This supersedes only the identified layout/interaction presentation in r1. Actual comparisons and independent per-ID verdicts belong in private `2026-10-15/implemented-r1/`. Keep draft PRs labelled `hold-for-review`, auto-merge off, until Sreekar gives final approval of actual evidence and exact heads. Proposal approval does not authorize merge.

## Daily five — 16 October 2026 implementation approval

Sreekar approved UXD-2026-10-16-03-A/B for implementation, with final approval of actual mobile and wide screens required before merging. The immutable [approved revision](https://github.com/atlashomesit/atlas-ux-evidence/blob/f581954f0f5aa6066b2ab016d25f813e1018fdad/docs/ux/daily-five/2026-10-16/r1/index.html) binds to proposal SHA256 `bf16010380e927cf92bc8ada2117be279748788bf7e7bd9683289309d18f0878`.

Privacy uses a compact intro, a native phone topic disclosure containing all eleven topics and open desktop navigation. Search recovery, remounting and resize must retain usable navigation. Rights, Cookie choices and Send a privacy request links move focus to the existing sections. All legal text, dates, consent semantics, form fields, validation, submit behavior, contact actions and tenant colors remain unchanged. Other legal routes retain their existing navigation behavior.

Actual three-column comparisons and independent intent/preservation and wide-workflow verdicts live in [implemented-r1](https://github.com/atlashomesit/atlas-ux-evidence/blob/main/docs/ux/daily-five/2026-10-16/implemented-r1/index.html). Keep the draft PR held with auto-merge off until Sreekar approves the actual result and exact final head.

## Approved value review — 18 October 2026

Sreekar said “i approve” while viewing the immutable [five-proposal r2](https://github.com/atlashomesit/atlas-ux-evidence/blob/1c8f07b9349c7de0a1c4b490fdede94c7c6f6ca8/docs/ux/daily-five/2026-10-17-next-ten/r2/index.html), manifest SHA256 695ee50f25cb96d795c82454c14ca7d7d3144a47fd1157cb4693f8dd8c9c2960.

UXV-2026-10-18-04 changes the phone sticky shortcut to Review booking only when the existing booking form is enabled and its selected-date price is ready. Real React summary state shares the authoritative Reserve disabled expression and calendar-pricing state. It focuses the same dates/price/Reserve form below the header; it never submits, creates a hold or starts payment. Missing/unavailable/pending/error states retain the date-picker path, while desktop, imagery, tenant colors, fees, cancellation and validation stay unchanged.

This supersedes only the identified placement/presentation/navigation decisions. The rejected r1 remains rejected. Actual current baseline / approved proposal / implementation comparisons and independent per-ID verdicts belong in private 2026-10-17-next-ten/implemented-r1. Hold draft PRs with auto-merge off until Sreekar gives separate final approval of actual results and exact PR heads.

## Approved daily UX restoration — 22 October 2026

The founder's approval of the proposals presented during 18–22 October includes [21 October r2](https://github.com/atlashomesit/atlas-ux-evidence/blob/main/docs/ux/daily-five/2026-10-21/r2/index.html#guest-property): WIDE-PROPERTY-SINGLE-R2-A places the existing booking column beside the single-photo gallery at desktop widths. UXV-2026-10-18-04 restores the ready phone shortcut's focus-only behavior without submitting. Existing pricing/availability guards, calendar fallback, rate-plan badge and Change plan control, imagery, colors, fees and checkout remain intact. Zero/multiple-photo layouts are outside this single-photo CSS rule.

This is implementation authorization only. The actual comparison bundle and independent per-ID verdicts remain required; hold the draft PR with auto-merge disabled until Sreekar explicitly approves the exact final head.


## Daily ten — 23 October r5 implementation approval, 24 October 2026

Sreekar said **“I approve all”** while viewing the immutable [r5 gallery](https://github.com/atlashomesit/atlas-ux-evidence/blob/77e5808e5a9c258b973b73d59d08478b8805c2c1/docs/ux/daily-five/2026-10-23/r5/index.html). Binding approval is private `2026-10-23/implemented-r1/APPROVAL.json`; gallery SHA-256 is `2107458bc5f0cdf0d56e9cc54cbfebd65ebdab232d08bec9ed7d98e3093ddf01`.

UXD-2026-10-23-08-A names each required rating group and star choice, exposes exactly the selected value with aria-pressed and persistent selected-value text, and retains existing hover/rating colors and submission validation. UXD-2026-10-23-09-A adds arrival/contact/count correction within the ID step with separate drafts, validation, Cancel/focus return and explicit confirmation before removing trailing guests. Keep retained guest objects, ID files, verification state, nationality, house rules and downstream payload semantics; adding a guest creates only a blank new record. No verification or payment service contract changes. This supersedes only those disclosed scopes. Preserve current colors, useful features, imagery, status/financial meanings, permissions and service contracts. Actual baseline / approved / implemented comparisons and independent per-ID review belong in `2026-10-23/implemented-r1/`. Keep draft PRs held with auto-merge off until Sreekar separately approves the actual result and exact final heads. No merge, direct dev push, release or deployment is authorized.

**27 October 2026:** Sreekar approved merging this batch to dev ("Yes, merge all three batches into dev"). No deployment, release cut or held-test activation was approved with it.


## Daily ten - 27 October 2026 implementation approval

Sreekar approved immutable private `docs/ux/daily-five/2026-10-27/r1` (archive commit `04fcfb9cbc600d41716a011fda249a4e1d8380d5`): "I approve all 10 proposals for 27 October. Implement them and show me the actual before and after on mobile and wide screens for final approval before merging." Receipt: `2026-10-27/implemented-r1/APPROVAL.json`.

This portal implements UXD-2026-10-27-01-A, 05-A, 06-A and 10-A only: gate unknown optional preferences after failed initial GET with read-only Retry and recovery focus; associate the existing correction labels; make the Pending host WhatsApp draft and helper factual using current booking identity; report upload uncertainty for a valid-photo HTTP 503. Preserve separately loaded consent/Withdraw, required transactional messages, preference and correction payloads, export/erasure, Confirmed wording and all other status eligibility, host destination, check-in/Google Calendar/ICS/Print, photo validation/auth/success/removal, profile drafts and deliberate file reselection. Existing colors and useful features remain.

This supersedes only those four disclosed behaviors in r1. Earlier held work is unchanged. Actual four-viewport comparisons, native interactions and independent per-ID review remain required. Hold for Sreekar's separate final approval of the actual results and exact heads before any merge; no direct dev push, deployment or activation of held E2E tests.


27 October 2026 implementation-review refinement (06-A only): keep the unchanged Pending helper immediately before the grouped WhatsApp/Google Calendar/ICS/Print actions. Inserting it between controls expanded the flex wrapping and newly obscured native keyboard focus at true 200% zoom; the compact original action group is restored while retaining the helper, all four actions, colors and existing floating widgets. This bounded preservation repair remains within r1 implementation authority and still requires refreshed native evidence, independent review and exact-head final approval.

## Worst-10 review fixes — 28 October 2026 (guest #661, founder: "keep merging everything to dev")

Independent review of the merged property-page change (private `atlas-ux-evidence/docs/ux/top-ten-weekly/2026-10-27/review/code-review-guest-landing.md` G1-G7 and `checks/verify-report.md` checks 5-6) found defects; this supersedes only the points below, nothing else in the approved 01-A to 01-E scope.

- Gallery fit: `object-fit: contain` is forced only for the two-photo layout (01-B). One photo keeps its contained image; three or more photos return to `cover`, as before #661. Do not add a rule that forces image fit for every gallery.
- Phone Chat button (01-D): the host stays one tap away. The button opens a small chooser: Message the host (WhatsApp, the same number and message as the desktop host bubble; only when the page has a host number), Questions about this stay (the listing's own FAQ panel, only when the listing has FAQs), and Booking and payment help (the existing support drawer, which reaches the platform's contact). With nothing to choose between it opens the drawer directly. The button uses fixed light colours because the bar's own surface is a fixed light palette in every theme.
- Layering: the support drawer opens above the sticky bar (the bar publishes its live height as `--pp-sticky-bar-offset` on `<body>`); the listing FAQ sheet and its backdrop stack above the bar.
- Virtual tours: the listing's 360 embed and the 3D tour section sit in the left column beside the booking card at 1024px and up, and the card spans down to the long left column so it keeps following the page.
- Booking card order at 1024px and up with the card beside the gallery: price, dates and guests, price lines, Reserve, then the reassurance blocks, then the listing preview photo (it repeats the gallery beside it). Nothing is removed; the pinned card now shows Reserve at 1280x720. This replaces the 01-E order only for the preview photo's position. Phone and tablet keep the established order.
- Desktop floaters (WhatsApp, FAQs, Chat with us) stack in the left gutter and step aside while the footer is within reach of the stack, so they never cover footer links.
- Not changed: the heritage layout (its own page, gallery mosaic and card position are as before #661) stays outside the beside-gallery layout until it has its own approval.
