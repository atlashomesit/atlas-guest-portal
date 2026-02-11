import { getApiBaseUrlSafe } from '@/config/api';

const resolveApiBaseUrl = (): string | null => {
  const baseUrl = getApiBaseUrlSafe();
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api] API base URL is invalid.', error);
    return null;
  }
};

export const buildApiUrl = (path: string): string => {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) {
    // Never return a relative path for API calls — they must go to the configured API origin (dev/prod).
    // Otherwise the request would hit the frontend origin and fail (dev "order not called" or wrong server).
    throw new Error(
      'API base URL is not configured. Set VITE_API_BASE_URL (or runtime config) and ensure the request goes to the API server.'
    );
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api] Failed to build API URL.', { path, baseUrl, error });
    throw error;
  }
};
