import { getApiBaseUrl, hasRuntimeConfig, getRuntimeConfig } from '@/runtime-config';
import { getTenantSlug } from '@/tenant/tenantResolver';

const resolveApiBaseUrl = (): string | null => {
  const baseUrl = getApiBaseUrl();

  try {
    const url = new URL(baseUrl);
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    console.error('[api] API base URL is invalid.', error);
    return null;
  }
};

/** Headers to attach to Atlas API requests when contract requires tenant (e.g. X-Tenant-Slug). */
export const getApiHeaders = (): Record<string, string> => {
  // Marketplace detail pages pass ?tenant=<slug> so cross-host listings resolve the correct host tenant.
  if (typeof window !== 'undefined') {
    const urlTenant = new URLSearchParams(window.location.search).get('tenant')?.trim();
    if (urlTenant) {
      return { 'X-Tenant-Slug': urlTenant };
    }
  }

  // Priority matches tenantResolver: domain-resolved slug first, runtime config tenantKey only as
  // fallback. This lets a single deploy serve multiple tenants by hostname while still allowing
  // dev/staging to force a slug via ATLAS_TENANT_KEY when the hostname can't be resolved.
  const fallbackSlug = hasRuntimeConfig() ? getRuntimeConfig().tenantKey?.trim() : undefined;
  const slug = getTenantSlug({ fallbackSlug });
  if (!slug) return {};
  return { 'X-Tenant-Slug': slug };
};

/**
 * Request headers the Atlas API's CORS layer permits on cross-origin browser calls.
 * MUST stay in sync with atlas-api's DynamicCorsMiddleware Access-Control-Allow-Headers. A header sent
 * from the browser but absent there makes the preflight fail, so the request never leaves the browser
 * (axios "Network Error") and checkout silently breaks. ('Accept' is CORS-safelisted — no server entry
 * needed.)
 */
export const CORS_ALLOWED_REQUEST_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Tenant-Slug',
  'X-Correlation-Id',
  'X-Request-Id',
  'Idempotency-Key',
] as const;

/** Headers for an idempotent JSON write to the API (Razorpay order create / booking hold). */
export const getOrderRequestHeaders = (idempotencyKey: string): Record<string, string> => ({
  ...getApiHeaders(),
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Idempotency-Key': idempotencyKey,
});

export const buildApiUrl = (path: string): string => {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    // Never return a relative path for API calls — they must go to the configured API origin (dev/prod).
    // Otherwise the request would hit the frontend origin and fail (dev "order not called" or wrong server).
    throw new Error(
      'API base URL is not configured. Ensure /.well-known/atlas-runtime-config.json has a valid apiBaseUrl.'
    );
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch (error) {
    console.error('[api] Failed to build API URL.', { path, baseUrl, error });
    throw error;
  }
};
