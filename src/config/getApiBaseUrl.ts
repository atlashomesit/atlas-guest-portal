declare global {
  interface Window {
    __ATLAS_RUNTIME_CONFIG__?: {
      apiBaseUrl?: string;
      googleMapsApiKey?: string;
    };
  }
}

const normalizeApiBaseUrl = (value: string | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

interface ImportMetaEnv {
  [key: string]: unknown;
}

interface ProcessEnv {
  [key: string]: string | undefined;
}

const readEnv = (key: string): string | undefined => {
  const metaEnv = typeof import.meta !== "undefined" 
    ? (import.meta as { env?: ImportMetaEnv }).env ?? {} 
    : {};
  const nodeEnv = typeof process !== "undefined" 
    ? (process as { env?: ProcessEnv }).env ?? {} 
    : {};
  const nodeValue = nodeEnv?.[key];
  const metaValue = metaEnv?.[key];
  if (typeof nodeValue === "string") return nodeValue;
  if (typeof metaValue === "string") return metaValue;
  return undefined;
};

const getRuntimeApiBaseUrl = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const runtimeConfig = (window as any).__ATLAS_RUNTIME_CONFIG__;
  const value = runtimeConfig?.apiBaseUrl;
  return typeof value === "string" ? value : undefined;
};

const missingConfigMessage =
  "VITE_API_BASE_URL is not configured. Expected Cloudflare Pages env var (available via /config). If you just added it in Cloudflare, redeploy once or confirm the correct environment (Preview vs Production).";

const DEFAULT_API_BASE_URL =
  "https://atlas-homes-api-gxdqfjc2btc0atbv.centralus-01.azurewebsites.net";

export const getApiBaseUrl = (): string => {
  // Directly return the development API URL
  return 'https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net';
  
  // The code below is kept for reference but will be unreachable
  const runtimeValue = normalizeApiBaseUrl(getRuntimeApiBaseUrl());
  const envValue = normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL"));
  const apiBaseUrl = runtimeValue || envValue;

  if (!apiBaseUrl) {
    // eslint-disable-next-line no-console
    console.warn(`${missingConfigMessage} Falling back to ${DEFAULT_API_BASE_URL}.`);
    return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
  }

  return apiBaseUrl;
};
