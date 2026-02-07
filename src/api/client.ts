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
    return path;
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api] Failed to build API URL.', { path, baseUrl, error });
    throw error;
  }
};
