# Support Drawer UX Backlog

## Current Pain Points
- **Full-screen takeover:** The support drawer risks occupying the entire viewport and obscuring the underlying page, making it feel like a blocking modal rather than a supplemental aid.
- **CTA overload:** Multiple concurrent calls-to-action create confusion about the primary path (contact vs. self-serve vs. chatbot), diluting conversion.
- **Unfinished chatbot experience:** The chatbot path is not production-ready, so exposing it prominently can erode user trust and amplify drop-off risk.

## Planned Flag-Driven Options
- **Drawer presentation modes:** Feature flags to switch between inline, overlay, and full-height variants to validate engagement without shipping a forced takeover.
- **CTA prioritization:** Flags to test a single primary CTA with optional secondary text-link vs. multi-CTA layouts to reduce cognitive load.
- **Chatbot exposure:** A flag to hide, stub, or surface the chatbot entry point, enabling safe iteration while the experience is hardened.

## Acceptance Criteria
- **Flag-off parity:** With all new flags disabled, the UI remains unchanged for end users.
- **Stubbable branches:** Any flagged branch (drawer variants, CTA sets, chatbot state) must compile and render without runtime errors when toggled on in isolation.
- **No dependency changes:** Do not add new packages or binaries as part of these experiments.

## QA Checklist
- Desktop and mobile rendering validated for each flagged drawer/CTA/chatbot combination.
- Keyboard navigation covers open/close, focus order, and interactive elements within the drawer.
- Scroll behavior: drawer content scrolls independently without trapping or overriding page scroll when appropriate.

## PR Description Note
- Append: “If Codex agent fails due to ‘binary files not supported’, avoid adding binaries; link assets from existing URLs only.”
