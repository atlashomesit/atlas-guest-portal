declare global {
  interface Window {
    __ATLAS_RUNTIME_CONFIG__?: {
      apiBaseUrl?: string;
      googleMapsApiKey?: string;
      env?: string;
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
  "API base URL is not configured. Set API_BASE_URL (Pages) or VITE_API_BASE_URL, or provide runtime config at /config.json.";

export const getApiBaseUrl = (): string => {
  const runtimeValue = normalizeApiBaseUrl(getRuntimeApiBaseUrl());
  const envValue = normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL") ?? readEnv("API_BASE_URL"));
  const apiBaseUrl = runtimeValue || envValue;
  const source = runtimeValue ? "runtime" : envValue ? "env" : "missing";
  const resolved = apiBaseUrl || "(empty)";
  // eslint-disable-next-line no-console
  console.info(`[api] API base URL (${source}): ${resolved}`);
  if (!apiBaseUrl) {
    const runtimeLog = runtimeValue || "(empty)";
    const envLog = envValue || "(empty)";
    // eslint-disable-next-line no-console
    console.info(`[api] API base URL inputs -> runtime: ${runtimeLog}, env: ${envLog}`);
  }

  if (!apiBaseUrl) {
    // eslint-disable-next-line no-console
    console.error(missingConfigMessage);
    throw new Error("API base URL is not configured");
  }

  return apiBaseUrl;
};
