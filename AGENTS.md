# Agent instructions (atlas-guest-portal)

## HARD RULE — GitHub Actions workflows (Sreekar-approved 2026-05-12)

**NEVER create, modify, or delete any file under `.github/workflows/`.**
Approved workflows are listed in `atlas-e2e/docs/governance/APPROVED-WORKFLOWS.md`.
If a task needs a new workflow, stop — add it to MANUAL-DEVELOPER-BACKLOG.md and wait
for Sreekar's approval. Violations will be reverted.

---

For AI assistants (Cursor, Codex, etc.) working in this repo:

- **Branch & stash discipline (READ FIRST):** Atlas multi-repo work follows 10 binding rules — push every commit in the same Bash call (no local-only branches across sessions), no stash older than 24h (convert to `wip/*` branch and push, or drop), branches max 5 days from dev, never `git add -A` after `git stash apply` or `git stash branch` (use specific paths), inventory branch state from origin refs only (local refs lie), abort on >2 file conflicts during consolidation runs. Full rules + 2026-05-10 incident postmortem: [atlas-e2e/docs/incidents/2026-05-10-multi-repo-branch-consolidation.md](../atlas-e2e/docs/incidents/2026-05-10-multi-repo-branch-consolidation.md). At session start, verify: `git status` clean, `git stash list` empty, no branch ahead of `origin/<branch>`. At session end, same verification before stopping.
- **Blocked work:** Up to **three** materially different attempts per blocker; if still stuck, append one row to [MANUAL-DEVELOPER-BACKLOG.md](../atlas-e2e/docs/product/MANUAL-DEVELOPER-BACKLOG.md) (Agent-deferred queue), then continue. Full rule: workspace root `AGENTS.md` (Blocked work section).
- **Task logging:** **Manual human developer tasks** and other human-only / ops work → [MANUAL-DEVELOPER-BACKLOG.md](../atlas-e2e/docs/product/MANUAL-DEVELOPER-BACKLOG.md). **Atlas developer tasks** (agent-ownable engineering) → [ATLAS-DEVELOPER-TASKS.md](../atlas-e2e/docs/product/ATLAS-DEVELOPER-TASKS.md) as `### TASK-…`. Routing detail: top of each file.
- **PRs and CI:** Run lint, build, and tests locally before suggesting a PR (see [CONTRIBUTING.md](CONTRIBUTING.md)). The **CI** workflow (`.github/workflows/ci.yml`) must pass before merge. Status check name for branch protection: **build**.
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
