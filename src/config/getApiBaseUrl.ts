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
  const runtimeConfig =
    typeof window !== "undefined"
      ? (window as any).__ATLAS_RUNTIME_CONFIG__
      : (globalThis as any).__ATLAS_RUNTIME_CONFIG__;
  const value = runtimeConfig?.apiBaseUrl;
  return typeof value === "string" ? value : undefined;
};

const missingConfigMessage =
  "API base URL is not configured. Set VITE_API_BASE_URL or provide a runtime config.";
const localhostErrorMessage =
  "VITE_API_BASE_URL cannot point to localhost in production environments";

const isDevBranchHost = (): boolean => {
  if (typeof window === "undefined") return false;
  const hostname = window.location?.hostname ?? "";
  return (
    hostname === "localhost" ||
    hostname.startsWith("dev.") ||
    hostname.endsWith(".pages.dev") ||
    hostname.includes("-dev.")
  );
};

export const getApiBaseUrl = (): string => {
  const runtimeValue = normalizeApiBaseUrl(getRuntimeApiBaseUrl());
  const envValue = normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL"));
  const apiBaseUrl = runtimeValue || envValue;
  const prodFlag = (readEnv("PROD") ?? "").toString().toLowerCase();
  const isProd = prodFlag === "true" || prodFlag === "1";

  if (isDevBranchHost()) {
    const source = runtimeValue ? "runtime" : envValue ? "env" : "missing";
    const resolved = apiBaseUrl || "(empty)";
    // eslint-disable-next-line no-console
    console.info(`[api] Dev host API base URL (${source}): ${resolved}`);
    if (!apiBaseUrl) {
      const runtimeLog = runtimeValue || "(empty)";
      const envLog = envValue || "(empty)";
      // eslint-disable-next-line no-console
      console.info(`[api] Dev host API base URL inputs -> runtime: ${runtimeLog}, env: ${envLog}`);
    }
  }

  if (!apiBaseUrl) {
    // eslint-disable-next-line no-console
    console.error(missingConfigMessage);
    throw new Error("API base URL is not configured");
  }

  if (isProd && /localhost|127\.0\.0\.1/i.test(apiBaseUrl)) {
    // eslint-disable-next-line no-console
    console.error(localhostErrorMessage);
    throw new Error("API base URL cannot point to localhost in production environments");
  }

  return apiBaseUrl;
};
