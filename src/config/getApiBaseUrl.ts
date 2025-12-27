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

const readEnv = (key: string): string | undefined => {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
  const nodeEnv = typeof process !== "undefined" ? (process as any).env ?? {} : {};
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
  "API base URL is not configured. Expected Cloudflare Pages env var VITE_API_BASE_URL (available via /config). If you just added it in Cloudflare, redeploy once or confirm the correct environment (Preview vs Production).";

export const getApiBaseUrl = (): string => {
  const runtimeValue = normalizeApiBaseUrl(getRuntimeApiBaseUrl());
  const envValue = normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL"));
  const apiBaseUrl = runtimeValue || envValue;

  if (!apiBaseUrl) {
    // eslint-disable-next-line no-console
    console.error(missingConfigMessage);
    throw new Error(missingConfigMessage);
  }

  const isTrue = (val: unknown) => val === true || val === "true";
  const devSignals = [
    readEnv("DEV"),
    typeof import.meta !== "undefined" ? (import.meta as any).env?.DEV : undefined,
    typeof process !== "undefined" ? (process as any).env?.DEV : undefined,
  ];
  const isDevLike =
    devSignals.some((val) => String(val).toLowerCase() === "true") ||
    (typeof window !== "undefined" && /localhost/i.test(window.location.hostname));
  const prodSignals = [
    readEnv("PROD"),
    readEnv("NODE_ENV"),
    typeof import.meta !== "undefined" ? (import.meta as any).env?.PROD : undefined,
    typeof import.meta !== "undefined" ? (import.meta as any).env?.NODE_ENV : undefined,
    typeof process !== "undefined" ? (process as any).env?.PROD : undefined,
    typeof process !== "undefined" ? (process as any).env?.NODE_ENV : undefined,
  ];
  const hasExplicitProd = prodSignals.some((val) => {
    if (val === undefined) return false;
    const normalized = String(val).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "production" || normalized === "prod";
  });
  const isProductionLike = hasExplicitProd || !isDevLike;
  const isLocalhostApi = /localhost/i.test(apiBaseUrl);

  if (isProductionLike && isLocalhostApi) {
    const localhostMessage = "VITE_API_BASE_URL cannot point to localhost in production environments";
    // eslint-disable-next-line no-console
    console.error(localhostMessage);
    throw new Error(localhostMessage);
  }

  return apiBaseUrl;
};
