/**
 * Serves /.well-known/atlas-runtime-config.json from Cloudflare Pages env vars.
 * When this Function is present, it overrides the static file in public/.well-known/
 * so dev/staging/production get the correct apiBaseUrl and discount per environment.
 *
 * Tenant slug for X-Tenant-Slug is resolved at runtime by the guest portal via
 * GET /tenants/from-domain (hostname) with optional tenantKey fallback below.
 *
 * Set in Pages → Project → Settings → Environment variables (Production / Preview):
 * - ATLAS_API_BASE_URL (required) e.g. https://your-dev-api.example.com
 * - ATLAS_GLOBAL_DISCOUNT_PERCENT (optional) 0–100, default 0
 * - ATLAS_ENVIRONMENT (optional) e.g. dev, production
 * - ATLAS_TENANT_KEY (optional) tenant slug fallback when from-domain is unavailable
 * - ATLAS_GOOGLE_MAPS_API_KEY (optional)
 */

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

export const onRequestGet = (context: { env: Env; request: Request }) => {
  const { env } = context;

  const apiBaseUrl = (env.ATLAS_API_BASE_URL ?? "").trim();
  const tenantKey = (env.ATLAS_TENANT_KEY ?? "").trim();
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
