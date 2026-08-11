# TASK-7464: deploy tenant-subdomain-router Worker (+ optional wildcard DNS).
# Does NOT flip Tenancy:SubdomainRoutingEnabled.
param(
  [switch]$WithDns,
  [string]$ZoneName = "atlastays.com"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Deploying Worker tenant-subdomain-router..."
npx wrangler deploy

if ($WithDns) {
  if (-not $env:CLOUDFLARE_API_TOKEN) { throw "CLOUDFLARE_API_TOKEN required for -WithDns" }
  Write-Host "Ensuring proxied AAAA * -> 100:: on $ZoneName ..."
  $headers = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)"; "Content-Type" = "application/json" }
  $zones = Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones?name=$ZoneName"
  $zoneId = $zones.result[0].id
  if (-not $zoneId) { throw "Zone $ZoneName not found" }
  $existing = Invoke-RestMethod -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?type=AAAA&name=*"
  if ($existing.result.Count -eq 0) {
    $body = @{ type = "AAAA"; name = "*"; content = "100::"; proxied = $true; ttl = 1 } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Headers $headers -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" -Body $body | Out-Null
    Write-Host "Created wildcard AAAA record."
  } else {
    Write-Host "Wildcard AAAA already present ($($existing.result.Count))."
  }
}

Write-Host @"

Deployed. Founder checklist (TASK-7464):
  1) npx wrangler secret put ATLAS_WORKER_PROXY_SECRET  (and same value on Pages)
  2) GET /api/admin/provisioning/wildcard-readiness → wildcardLive:true
  3) Browser-verify existing hand-bound hostnames still serve
  4) Do NOT flip Tenancy:SubdomainRoutingEnabled in this task
"@
