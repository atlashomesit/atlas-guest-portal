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
  const slug = getTenantSlug({
    fallbackSlug: hasRuntimeConfig() ? getRuntimeConfig().tenantKey : undefined,
  });
  if (!slug) return {};
  return { 'X-Tenant-Slug': slug };
};

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
