# Custom-domain SSL renewal monitoring (TASK-102419)

Tenant direct sites on custom domains (e.g. `stays.villashanti.com`) must never fail
SSL renewal silently — an expired certificate shows guests a browser privacy warning
and kills the booking funnel.

## Frontend half (this repo — shipped)

- `src/utils/sslExpiry.ts` — typed renewal-health model: `daysUntilExpiry`,
  `sslRenewalStatus` (`healthy`/`warning` ≤14d / `urgent` ≤3d or renewal-failed /
  `expired`), `sslAlertCopy` for a tenant-admin banner.
- Thresholds: warn at 14 days before expiry, urgent at 3 days — matching the board's
  "alert DevOps 14 days before expiry" requirement.

## Backend half (explicitly out of scope here — needs atlas-api / hosting owner)

1. ACME (Let's Encrypt) renewal cron must alert ops on DNS-challenge failure instead
   of failing silently.
2. Expose the certificate `expiryUtc` + `renewalFailed` flags per custom domain (status
   endpoint or tenant config) so the portal can feed `sslRenewalStatus` with live data.
3. Until (2) exists, the portal model is ready but unwired — wire it to the endpoint
   when it lands; do not invent expiry dates client-side.
