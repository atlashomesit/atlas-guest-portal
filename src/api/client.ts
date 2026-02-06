import { getApiBaseUrl } from '@/config/api';

const resolveApiBaseUrl = (): string => {
  try {
    const baseUrl = getApiBaseUrl();
    const url = new URL(baseUrl);
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api] API base URL is invalid or missing.', error);
    throw error;
  }
};

export const buildApiUrl = (path: string): string => {
  const baseUrl = resolveApiBaseUrl();

  try {
    return new URL(path, baseUrl).toString();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api] Failed to build API URL.', { path, baseUrl, error });
    throw error;
  }
};
