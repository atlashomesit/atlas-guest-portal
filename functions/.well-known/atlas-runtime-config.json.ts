/**
 * Serves /.well-known/atlas-runtime-config.json from Cloudflare Pages env vars.
 * When this Function is present, it overrides the static file in public/.well-known/
 * so dev/staging/production get the correct apiBaseUrl and discount per environment.
 *
 * Supports multiple domains/tenants pointing to the same Cloudflare Pages project.
 * Hostname detection: if request is for starguesthouse.atlastays.com, use SGH config.
 *
 * Set in Pages → Project → Settings → Environment variables (Production / Preview):
 * - ATLAS_API_BASE_URL (required) e.g. https://your-dev-api.example.com
 * - ATLAS_GLOBAL_DISCOUNT_PERCENT (optional) 0–100, default 0
 * - ATLAS_ENVIRONMENT (optional) e.g. dev, production
 * - ATLAS_TENANT_KEY (optional) tenant slug for X-Tenant-Slug header, e.g. atlas (required for API when host is dev.*)
 * - ATLAS_GOOGLE_MAPS_API_KEY (optional)
 * - SGH_API_BASE_URL (optional) API URL for Star Guest House domain
 * - SGH_TENANT_KEY (optional) Tenant key for Star Guest House (defaults to "starguesthouse")
 */

interface Env {
  ATLAS_API_BASE_URL?: string;
  ATLAS_GLOBAL_DISCOUNT_PERCENT?: string;
  ATLAS_ENVIRONMENT?: string;
  ATLAS_TENANT_KEY?: string;
  ATLAS_GOOGLE_MAPS_API_KEY?: string;
  ATLAS_WEB_PUSH_PUBLIC_KEY?: string;
  SGH_API_BASE_URL?: string;
  SGH_TENANT_KEY?: string;
}

function parseDiscount(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n;
}

export const onRequestGet = (context: { env: Env; request: Request }) => {
  const { env, request } = context;

  // Detect hostname to route to correct tenant config
  const hostname = request.headers.get("host") || "";
  const isStarGuestHouse = hostname.includes("starguesthouse");

  // Select config based on hostname, with fallback logic
  let apiBaseUrl: string;
  let tenantKey: string;
  let environment: string;

  if (isStarGuestHouse) {
    // Star Guest House: prefer SGH_API_BASE_URL, fallback to ATLAS_API_BASE_URL
    apiBaseUrl = (env.SGH_API_BASE_URL ?? env.ATLAS_API_BASE_URL ?? "").trim();
    tenantKey = (env.SGH_TENANT_KEY ?? "starguesthouse").trim();
    environment = (env.ATLAS_ENVIRONMENT ?? "production").trim();
  } else {
    // Atlas Homestays: use ATLAS_API_BASE_URL
    apiBaseUrl = (env.ATLAS_API_BASE_URL ?? "").trim();
    tenantKey = (env.ATLAS_TENANT_KEY ?? "").trim();
    environment = (env.ATLAS_ENVIRONMENT ?? "").trim();
  }

  if (!apiBaseUrl) {
    const errorMsg = isStarGuestHouse
      ? "SGH_API_BASE_URL or ATLAS_API_BASE_URL is not set in Cloudflare Pages environment variables"
      : "ATLAS_API_BASE_URL is not set in Cloudflare Pages environment variables";
    return new Response(
      JSON.stringify({ error: errorMsg }),
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
