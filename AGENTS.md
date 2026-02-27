# Agent instructions (RatebotaiRepo — Atlas guest frontend)

For AI assistants (Cursor, Codex, etc.) working in this repo:

- **PRs and CI:** Run lint, build, and tests locally before suggesting a PR (see [CONTRIBUTING.md](CONTRIBUTING.md)). The **CI** workflow (`.github/workflows/ci.yml`) must pass before merge. Status check name for branch protection: **build**.
- **Feature work:** Backend roadmap and execution workflow live at the workspace root — see `ATLAS-HIGH-VALUE-BACKLOG.md` and `ATLAS-FEATURE-EXECUTION-PROMPT.md` when changes span API and guest frontend.
- **Docs:** See `docs/design-system.md`, `docs/short-links.md`, and README for theming, short links, and project map. Messaging/booking integration: `atlas-api/docs/eventing-servicebus-implementation-plan.md`.
