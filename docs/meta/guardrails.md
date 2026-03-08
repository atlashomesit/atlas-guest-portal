# Docs Guardrails (atlas-guest-portal / atlas-guest-portal)

**Purpose:** Prevent guest portal documentation (booking funnel, RCAs, runbooks) from drifting away from the codebase.

**Audience:** Developer | Ops

**Owner:** Atlas Tech Solutions

**Last updated:** 2026-02-22

**Related:** [canonical system docs](../../../atlas-e2e/docs/README.md) | [RCA index](../rca/guest-portal-zero-price.md)

---

## Non-negotiable rules

- **Do not delete docs.** Prefer **DEPRECATED** banners + canonical links.
- Keep repo-local docs repo-local; canonical system docs live in `atlas-e2e/docs/`.
- Relative links within `docs/**` must work.

## Freshness rules

- If checkout flow changes → update `docs/booking-funnel.md` and any relevant RCAs/runbooks.
- If tenant resolution / base URL wiring changes → update `docs/ops/guest-portal-api-base-url-wiring.md` and runtime config runbooks.
- If pricing display rules change → ensure we still enforce “never show ₹0” and keep the RCA references current.

## Guardrails checks

See [progress-ledger](progress-ledger.md).

