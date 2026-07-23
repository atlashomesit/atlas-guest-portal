## Checklist

- [ ] **Docs impacted?** (yes/no + links)
- [ ] **ADR needed?** (yes/no; if yes, link ADR)
- [ ] **Runtime config changed?** (yes/no; if yes, update `docs/runbooks/runtime-config.md`)
- [ ] **API contract changed?** (yes/no; if yes, update `atlas-api/docs/api-contract.md` + OpenAPI)

### Pull Request Summary

> Briefly describe the changes in this PR.

---

### Checklist

- [ ] Lint, build, and tests pass locally (`npm run lint`, `npm run build`, `npm test`)
- [ ] **CI** workflow (`.github/workflows/ci.yml`) must pass before merge
- [ ] See [CONTRIBUTING.md](CONTRIBUTING.md) for the full PR checklist
- [ ] **Irreversible step?** Migrations / financial backfills / tenant archival → state **irreversible: yes/no** + rollback plan in the PR description.
- [ ] No secrets or env files committed

---

### Notes

> Optional: deployment impact, known issues, or follow-ups.
