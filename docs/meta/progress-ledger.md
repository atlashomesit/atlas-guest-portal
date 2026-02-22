# Docs Guardrails — Progress Ledger (RatebotaiRepo)

**Purpose:** Track docs-as-code guardrails and how to run them locally.

**Audience:** Developer

**Owner:** Atlas Tech Solutions

**Last updated:** 2026-02-22

**Related:** [guardrails](guardrails.md)

---

## Current guardrails

- Workflow: `.github/workflows/docs-guardrails.yml`
- Script: `scripts/docs/guardrails.mjs`

## How to run locally

From `RatebotaiRepo/`:

```bash
node ./scripts/docs/guardrails.mjs
```

Optional (lint):

```bash
npx --yes markdownlint-cli2 "docs/**/*.md" "README.md" "ARCHITECTURE.md"
npx --yes cspell lint -c ./cspell.json "docs/**/*.md" "README.md" "ARCHITECTURE.md"
```

