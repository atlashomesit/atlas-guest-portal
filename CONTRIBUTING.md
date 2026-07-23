# Contributing Guidelines

We welcome contributions that improve the Atlas Homes Frontend. Please follow this workflow to keep the project healthy and predictable.

For feature work spanning the guest frontend and API, see workspace root `ATLAS-HIGH-VALUE-BACKLOG.md` and `ATLAS-FEATURE-EXECUTION-PROMPT.md`.

## Release Gate (run before pushing to dev)

```bash
cd atlas-e2e; npm run release-gate
```

This is the **single pre-commit gate** for all repos. It runs lint, build, unit tests, integration tests, migrations, smoke curls, and Playwright E2E across all four repos. See [atlas-e2e/docs/PROD_READINESS_CHECKLIST.md](../atlas-e2e/docs/PROD_READINESS_CHECKLIST.md) for the full 16-gate DevSecOps mapping.

## Shift-left (HARD RULE 13 + 6, amended 2026-07-22)

Any new or materially changed user-facing behavior requires E2E coverage in the same push, exercising every input modality the surface supports. Full rule text: [`AGENTS.md`](./AGENTS.md) · [`atlas-e2e/interaction-surfaces.json`](../atlas-e2e/interaction-surfaces.json) (ADR-0087).

## Branching Model
- **Branch from `dev`**, not `main`. `main` is the prod-deploy branch and may only receive commits via a PR from `dev`. See [workspace branch policy](../atlas-e2e/docs/POLICY-BRANCH-AND-DEPLOY.md).
- Create feature branches from `dev` using the convention `feature/<short-description>`. Use `fix/`, `docs/`, or `chore/` prefixes for bug fixes, documentation updates, and tooling work.
- The `dev → main` PR is the only path to prod. PRs from any other branch to `main` are auto-rejected by the `enforce-dev-to-main` GitHub Actions workflow.

## Development Process
1. **Sync `dev`:**
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. **Create a branch from dev:**
   ```bash
   git checkout -b feature/add-property-carousel
   ```
3. **Install dependencies** (`npm ci` for clean install; `npm install` to add packages):
   ```bash
   npm ci
   ```
4. **Run the dev server:**
   ```bash
   npm run dev
   ```
5. **Run lint checks before committing:**
   ```bash
   npm run lint
   ```
6. **Commit with a descriptive message:**
   ```bash
   git commit -am "Add testimonial slider autoplay controls"
   ```

## Pull Request Checklist
- [ ] Reference related issues in the description.
- [ ] Summarize high-level changes and screenshots when UI is impacted.
- [ ] Run the **release gate** (`cd atlas-e2e; npm run release-gate`) or at minimum: `npm ci && npm run lint && npm run build && npm test`.
- [ ] The **CI** workflow (`.github/workflows/ci.yml`) runs the same on push/PR; it must pass before merge.
- [ ] **Never commit `.env` or `.env.local`** – they may contain API keys and other secrets; keep them out of version control.
- [ ] Update documentation when new configuration, commands, or data model changes occur.
- [ ] Request review from at least one maintainer.

## Code Style Notes
- Prefer functional React components with hooks.
- Keep JSX lean by extracting repeated structures into sub-components inside `src/components`.
- Tailwind utilities are preferred; fall back to component-level CSS modules when necessary (see `src/components/commonComponents/navbar/Navbar.tsx` and `navbar.css`).
- Store reusable data objects (e.g., navigation links, property definitions) in `src/data.ts` to keep presentation logic focused on rendering.

## Commit Message Format
- Use the imperative mood ("Add", "Fix", "Refine").
- Prefix the first line with a category when helpful, e.g., `feat:`, `fix:`, `docs:`, `refactor:`.
- Keep the subject line under 72 characters; include additional context in the body when needed.

## Release Notes
- Tag release commits in `main` with `vX.Y.Z`.
- Summarize key UI or data changes in the release description, especially if property inventory is updated.

Thank you for contributing!
