# Secret rotation (Atlas)

If Gitleaks or another scanner reports a **real** credential in git history or in a PR: **rotate first**, then fix or allowlist the finding. Removing the string in a new commit does **not** revoke a secret that still exists in older commits.

## Razorpay

1. Create new keys at [Razorpay Dashboard → API Keys](https://dashboard.razorpay.com/app/keys).
2. Update Azure App Service configuration for **atlas-api** (production and dev deployment slots): application settings that hold Razorpay key id/secret for the environment.
3. Invalidate or delete the old key pair in Razorpay after traffic is on the new key.

## Azure Storage

1. Rotate keys in Azure Portal for the affected storage account.
2. Update connection strings or `AccountKey` values in App Service application settings (and any other consumers).

## Azure SQL (database password)

1. Change the login password in Azure SQL.
2. Update `ConnectionStrings__Default` (or equivalent) on the App Service for atlas-api.

## Atlas API bearer tokens

Regenerate or re-issue tokens using the admin portal flows your team uses for API access; revoke the leaked token.

## Ownership and downtime

**Owner:** backend lead. **Expected impact:** under a few minutes per rotation when updating App Service settings (hot reload of config).

## CI

This repo’s `.github/workflows/secret-scan.yml` is informational until promoted to a **required** status check after a soak period.
