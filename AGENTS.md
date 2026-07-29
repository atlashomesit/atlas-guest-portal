# Agent instructions (atlas-guest-portal)

## HARD RULE — GitHub Actions workflows (Sreekar-approved 2026-05-12)

**NEVER create, modify, or delete any file under `.github/workflows/`.**
Approved workflows are listed in `atlas-e2e/docs/governance/APPROVED-WORKFLOWS.md`.
If a task needs a new workflow, stop — add it to MANUAL-DEVELOPER-BACKLOG.md and wait
for Sreekar's approval. Violations will be reverted.

## HARD RULE — Shift-left (amended 2026-07-22) / Verification (HARD RULE 13 + 6)

> **Shift-left (HARD RULE 13, amended 2026-07-22):** Any new or materially changed user-facing behavior (endpoint, page, or interaction: gesture, scroll-load, drag) requires E2E coverage AUTHORED in the same push (validated via tsc + `npx playwright test <spec> --list` — legal from any branch), exercising every input modality the surface supports. This applies to every route into `dev` — PR or direct push. The spec EXECUTES post-merge on dev; E2E execution never gates the dev merge (MERGE-FAST 2026-07-29).
>
> **Verification (HARD RULE 6, amended):** "Verified live" must exercise the input modality the change targets.

Mechanical enforcement: `atlas-e2e/interaction-surfaces.json` + `atlas-e2e/scripts/check-surface-test-delta.mjs` (ADR-0087).

## HARD RULE — Theme ≠ integration (Sreekar-approved 2026-07-17, canonical for ALL changes to this repo)

**A theme change changes theme content only — never the Atlas PMS integration.** Two directions, both binding:

1. **Presentation and integration are separate layers.** Theme work (a theme package under `src/themes/`, tokens, CSS, page composition) must not modify the PMS integration layer: API clients (`src/api/`), booking/payment/hold flows, tenant resolution (`src/tenant/`), entitlement handling, data hooks, or shared business-logic components. Dependency direction is one-way: themes import from the shared library; no module outside `src/themes/` may ever import from `src/themes/` — sole exception: the theme mount point (`src/App.tsx`/`src/main.tsx` importing `src/themes/registry`). A PR whose purpose is a theme may only touch `src/themes/<id>/**` (plus its E2E smoke spec); if a theme genuinely needs a shared-layer change, that change is a separate, theme-agnostic PR justified on its own merits.
2. **Everything tenant-variable is configurable from Atlas PMS.** Behavior or content that differs per tenant must be driven by API/DB config (`Tenant` fields, `WebsiteThemeId`, entitlements, listing data) — never hardcoded per tenant in this repo (no slug-keyed conditionals in shared components). `src/tenant/tenantOverrides.ts` is an acknowledged legacy stopgap being absorbed into DB config — do not add new entries when a DB field exists, and never extend the pattern elsewhere.

Why this exists: 2026-07 incident — tenant-specific edits in shared code shipped to every tenant's site. Architecture: ADR-0081 (+ 2026-07-17 amendments), epic `guest-portal-theme-gallery.md`. Violations will be reverted.

---

For AI assistants (Cursor, Codex, etc.) working in this repo:

- **Branch & stash discipline (READ FIRST):** Atlas multi-repo work follows 10 binding rules — push every commit in the same Bash call (no local-only branches across sessions), no stash older than 24h (convert to `wip/*` branch and push, or drop), branches max 5 days from dev, never `git add -A` after `git stash apply` or `git stash branch` (use specific paths), inventory branch state from origin refs only (local refs lie), abort on >2 file conflicts during consolidation runs. Full rules + 2026-05-10 incident postmortem: [atlas-e2e/docs/incidents/2026-05-10-multi-repo-branch-consolidation.md](../atlas-e2e/docs/incidents/2026-05-10-multi-repo-branch-consolidation.md). At session start, verify: `git status` clean, `git stash list` empty, no branch ahead of `origin/<branch>`. At session end, same verification before stopping.
- **Blocked work:** Up to **three** materially different attempts per blocker; if still stuck, append one row to [MANUAL-DEVELOPER-BACKLOG.md](../atlas-e2e/docs/product/MANUAL-DEVELOPER-BACKLOG.md) (Agent-deferred queue), then continue. Full rule: workspace root `AGENTS.md` (Blocked work section).
- **Task logging:** **Manual human developer tasks** and other human-only / ops work → [MANUAL-DEVELOPER-BACKLOG.md](../atlas-e2e/docs/product/MANUAL-DEVELOPER-BACKLOG.md). **Atlas developer tasks** (agent-ownable engineering) → [ATLAS-DEVELOPER-TASKS.md](../atlas-e2e/docs/product/ATLAS-DEVELOPER-TASKS.md) as `### TASK-…`. Routing detail: top of each file.
- **PRs and CI:** Run lint, build, and tests locally before suggesting a PR (see [CONTRIBUTING.md](CONTRIBUTING.md)). The **CI** workflow (`.github/workflows/ci.yml`) must pass before merge. Status check name for branch protection: **build**.
- **PR merge strategy — HARD RULE:** Always merge-commit. `gh pr merge <N> --merge --repo atlashomesit/atlas-guest-portal`. The "Rebase and merge" button stays enabled in the UI only because GitHub's API forbids disabling both rebase and squash at once; treat it as if it weren't there. Squash is forbidden. Full policy + why the 2026-05-20 rebase-only rule was reverted: [atlas-e2e/docs/governance/PR-MERGE-STRATEGY.md](../atlas-e2e/docs/governance/PR-MERGE-STRATEGY.md).
- **Feature work:** Product roadmap and execution workflow live in [atlas-e2e/docs/product/](../atlas-e2e/docs/product/) — use `backlog.md` and `ATLAS-DEVELOPER-TASKS.md` for current priorities spanning API + guest frontend.
- **Docs:** See `docs/design-system.md`, `docs/short-links.md`, and README for theming, short links, and project map. Messaging/booking integration: `atlas-api/docs/eventing-servicebus-implementation-plan.md`.
- **Security (CISO):** Cloudflare Pages serves `public/_headers` (CSP, HSTS, frame-ancestors). When adding third-party scripts or API origins, update `_headers` and note the change in `atlas-e2e/docs/context/integration-contract.md` if it affects payments or auth.
- **Commit message guard (TASK-2462):** Install once per clone (Git Bash): `printf '%s\n' '#!/bin/sh' 'exec sh "$(git rev-parse --show-toplevel)/../atlas-e2e/scripts/git-hooks/commit-msg-validator.sh" "$1"' > .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg` — requires sibling `atlas-e2e`. Bypass: `git commit --no-verify`.

## Current architecture conventions

- **Booking APIs are `/api/...`:** client modules should use `buildApiUrl("/api/...")` and not bare route prefixes.
- **Contact/support details are centralized:** use `src/config/contact.ts` helpers for phone/WhatsApp links; avoid hardcoded numbers in page components.
- **Banner usage:** common banner components must handle missing assets gracefully (fallback UI instead of broken `<img>`).
- **CSP discipline:** any Razorpay, Maps, or analytics origin changes require matching `public/_headers` updates.

## Recent architectural changes (since 2026-04-12)

- `d7b264bb` — pricing endpoint paths fixed to canonical `/api/pricing/...` routes.
- `1eccd4d0` + `9150baae` — contact/banner resilience: gradient fallback and missing-asset warning cleanup.
- `1f12a4e2` — `dev` merged into `main` for guest portal release alignment.
- `3f45a626` — booking confirmation voucher download feature added.
- `428959e3` + `7d55c09e` — UX/accessibility polish batch across guest booking surfaces.
- `494eaa67` — guest nationality compliance field shipped.
- `4a2d76ed` — search amenity filters (AC/Parking/Pool/WiFi) added.
- `ffa61c9a` + `b8e7cf16` — onboarding flow now stores `propertyId` from start response to avoid plan-limit dead end.
- `b52b5965` + `329d4691` — Razorpay CSP allowlist tightened/updated in Cloudflare headers.
- `7dd1d77b` + `cc496a0f` — CookieConsentBanner/DPDP privacy flow established as the active consent pattern.
