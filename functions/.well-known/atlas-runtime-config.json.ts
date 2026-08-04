/**
 * Serves /.well-known/atlas-runtime-config.json from Cloudflare Pages env vars.
 * When this Function is present, it overrides the static file in public/.well-known/
 * so dev/staging/production get the correct apiBaseUrl and discount per environment.
 *
 * Tenant slug for X-Tenant-Slug is resolved at runtime by the guest portal via
 * GET /tenants/from-domain (hostname); the `tenantKey` emitted here is only the fallback used
 * when that boot-time call fails. For tenant subdomains / custom domains this Function resolves
 * the slug from the SAME authoritative endpoint (see ../_lib/tenantSlug.ts) instead of guessing
 * it from the subdomain label — the label is not the slug, and the old guess emitted values that
 * 404 (millionairesmansion.atlastays.com -> guessed `millionairesmansion`, real slug `mahesh-wagh`).
 * One Pages project serves every tenant by hostname, so a single ATLAS_TENANT_KEY env var cannot
 * be per-tenant; it remains only as a manual override for hosts the API cannot resolve.
 *
 * Set in Pages → Project → Settings → Environment variables (Production / Preview):
 * - ATLAS_API_BASE_URL (required) e.g. https://your-dev-api.example.com
 * - ATLAS_GLOBAL_DISCOUNT_PERCENT (optional) 0–100, default 0
 * - ATLAS_ENVIRONMENT (optional) e.g. dev, production
 * - ATLAS_TENANT_KEY (optional) tenant slug fallback when from-domain cannot resolve the host
 * - ATLAS_GOOGLE_MAPS_API_KEY (optional)
 */

import { isAtlasDirectBookingHost, isMarketplaceHost } from "../_lib/tenantSiteMeta";
import { resolveTenantSlugFromDomain } from "../_lib/tenantSlug";

interface Env {
  ATLAS_API_BASE_URL?: string;
  ATLAS_GLOBAL_DISCOUNT_PERCENT?: string;
  ATLAS_ENVIRONMENT?: string;
  ATLAS_TENANT_KEY?: string;
  ATLAS_GOOGLE_MAPS_API_KEY?: string;
  ATLAS_WEB_PUSH_PUBLIC_KEY?: string;
}

function parseDiscount(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n;
}

export const onRequestGet = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  const apiBaseUrl = (env.ATLAS_API_BASE_URL ?? "").trim();
  const environment = (env.ATLAS_ENVIRONMENT ?? "").trim();

  if (!apiBaseUrl) {
    return new Response(
      JSON.stringify({ error: "ATLAS_API_BASE_URL is not set in Cloudflare Pages environment variables" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  let tenantKey: string | null;

  if (host.includes("nightnesthospitalityservices")) {
    tenantKey = "Nightnest";
  } else if (isMarketplaceHost(host)) {
    // Sentinel, not a real tenant — `main.tsx`'s activateMarketplaceSurface() reads it.
    tenantKey = "marketplace";
  } else if (isAtlasDirectBookingHost(host) || host.endsWith(".localhost")) {
    tenantKey = "atlas";
  } else {
    // A tenant subdomain or custom domain. Ask the authoritative endpoint rather than guessing
    // from the subdomain label: the label is not the slug (millionairesmansion.atlastays.com is
    // tenant `mahesh-wagh`), so the guess emitted a 404ing slug and, whenever boot-time
    // from-domain resolution failed, sent the browser down validateTenant() -> 404 -> throw ->
    // ConfigErrorScreen. Resolving here makes the fallback agree with runtime resolution.
    tenantKey =
      (await resolveTenantSlugFromDomain(apiBaseUrl, host)) || env.ATLAS_TENANT_KEY?.trim() || null;
    // Deliberately no `|| "atlas"` final default: emitting Atlas's own slug for an unresolved
    // third-party host would render Atlas branding on a stranger's domain (the leak TASK-2642
    // added SubdomainNotActivatedScreen to prevent). Omitting `tenantKey` instead lets boot
    // surface an honest "tenant could not be resolved" error.
  }

  const config: Record<string, unknown> = {
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ""),
    globalDiscountPercent: parseDiscount(env.ATLAS_GLOBAL_DISCOUNT_PERCENT),
    ...(environment ? { environment } : {}),
    ...(env.ATLAS_GOOGLE_MAPS_API_KEY?.trim()
      ? { googleMapsApiKey: env.ATLAS_GOOGLE_MAPS_API_KEY.trim() }
      : {}),
    ...(env.ATLAS_WEB_PUSH_PUBLIC_KEY?.trim()
      ? { webPushPublicKey: env.ATLAS_WEB_PUSH_PUBLIC_KEY.trim() }
      : {}),
  };

  if (tenantKey) config.tenantKey = tenantKey;

  return new Response(JSON.stringify(config, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
