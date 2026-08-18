#!/usr/bin/env bash
# TASK-7464 / ADR-0096: one-shot wildcard Worker deploy (founder/ops).
# Requires: Cloudflare login (`npx wrangler login`) OR CLOUDFLARE_API_TOKEN with Zone.DNS + Workers edit.
# Does NOT flip Tenancy:SubdomainRoutingEnabled — that is a separate founder step after the readiness probe is green.
set -euo pipefail
cd "$(dirname "$0")"

echo "Deploying tenant-subdomain-router Worker + *.atlastays.com/* route..."
npx wrangler deploy

echo ""
echo "NEXT (founder):"
echo "  1) Ensure proxied AAAA * -> 100:: on atlastays.com (or: pwsh ./deploy-wildcard.ps1 -WithDns)"
echo "  2) Set shared secret on Worker AND Pages:"
echo "       npx wrangler secret put ATLAS_WORKER_PROXY_SECRET"
echo "       (Pages project → env var ATLAS_WORKER_PROXY_SECRET = same value)"
echo "  3) Verify GET /api/admin/provisioning/wildcard-readiness → wildcardLive:true"
echo "  4) Browser-check an existing hand-bound slug + a random probe label"
echo "  5) Do NOT flip Tenancy:SubdomainRoutingEnabled until step 3 is green (out of scope for TASK-7464)"
