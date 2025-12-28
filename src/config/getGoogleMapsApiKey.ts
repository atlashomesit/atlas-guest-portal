declare global {
  interface Window {
    __ATLAS_RUNTIME_CONFIG__?: {
      apiBaseUrl?: string;
      googleMapsApiKey?: string;
    };
  }
}

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

const getRuntimeGoogleMapsApiKey = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const runtimeConfig = window.__ATLAS_RUNTIME_CONFIG__;
  const value = runtimeConfig?.googleMapsApiKey;
  return typeof value === "string" ? value.trim() : undefined;
};

const normalizeGoogleMapsApiKey = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const missingConfigMessage =
  "Google Maps API key is not configured. Expected NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (available via /config). Falling back to the static map preview.";

export const getGoogleMapsApiKey = (): string | undefined => {
  const runtimeValue = normalizeGoogleMapsApiKey(getRuntimeGoogleMapsApiKey());
  const envValue = normalizeGoogleMapsApiKey(readEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  const apiKey = runtimeValue || envValue;

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(missingConfigMessage);
    return undefined;
  }

  return apiKey;
};
