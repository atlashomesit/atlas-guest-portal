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

const isPrivateIpv4 = (hostname: string): boolean => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  const [a, b] = hostname.split(".").map((part) => Number(part));
  if ([a, b].some((part) => Number.isNaN(part))) return false;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const isPrivateHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost") return true;
  if (normalized.endsWith(".local")) return true;
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return isPrivateIpv4(normalized);
};

const isPrivateNetworkUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
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

const DEFAULT_API_BASE_URLS = {
  production: "https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net",
  preview: "https://atlas-homes-api-dev-fhdtg0gkgmcmhwfd.centralindia-01.azurewebsites.net",
};

const getHostname = (): string => {
  if (typeof window !== "undefined") {
    return window.location?.hostname ?? "";
  }
  if (typeof location !== "undefined") {
    return location.hostname ?? "";
  }
  return "";
};

const getDefaultApiBaseUrl = (): string => {
  const hostname = getHostname().toLowerCase();
  if (!hostname) return "";
  const isPreviewHost = hostname.includes("dev.") || hostname.endsWith(".pages.dev");
  return isPreviewHost ? DEFAULT_API_BASE_URLS.preview : DEFAULT_API_BASE_URLS.production;
};

export const getApiBaseUrl = (): string => {
  const runtimeValue = normalizeApiBaseUrl(getRuntimeApiBaseUrl());
  const envValue = normalizeApiBaseUrl(readEnv("VITE_API_BASE_URL") ?? readEnv("API_BASE_URL"));
  const defaultValue = normalizeApiBaseUrl(getDefaultApiBaseUrl());
  const apiBaseUrl = runtimeValue || envValue || defaultValue;
  const source = runtimeValue ? "runtime" : envValue ? "env" : defaultValue ? "default" : "missing";
  const resolved = apiBaseUrl || "(empty)";
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) {
    console.info(`[api] API base URL (${source}): ${resolved}`);
  }
  if (!apiBaseUrl) {
    const runtimeLog = runtimeValue || "(empty)";
    const envLog = envValue || "(empty)";
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV) {
      console.info(`[api] API base URL inputs -> runtime: ${runtimeLog}, env: ${envLog}`);
    }
  }

  const devSignals = [
    readEnv("DEV"),
    typeof import.meta !== "undefined" ? (import.meta as { env?: ImportMetaEnv }).env?.DEV : undefined,
    typeof process !== "undefined" ? (process as { env?: ProcessEnv }).env?.DEV : undefined,
  ];
  const isDevLike =
    devSignals.some((val) => String(val).toLowerCase() === "true") ||
    (typeof window !== "undefined" && /localhost/i.test(window.location.hostname));
  const prodSignals = [
    readEnv("PROD"),
    readEnv("NODE_ENV"),
    typeof import.meta !== "undefined" ? (import.meta as { env?: ImportMetaEnv }).env?.PROD : undefined,
    typeof import.meta !== "undefined" ? (import.meta as { env?: ImportMetaEnv }).env?.NODE_ENV : undefined,
    typeof process !== "undefined" ? (process as { env?: ProcessEnv }).env?.PROD : undefined,
    typeof process !== "undefined" ? (process as { env?: ProcessEnv }).env?.NODE_ENV : undefined,
  ];
  const hasExplicitProd = prodSignals.some((val) => {
    if (val === undefined) return false;
    const normalized = String(val).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "production" || normalized === "prod";
  });
  const isProductionLike = hasExplicitProd || !isDevLike;
  const isPrivateNetworkApi = isPrivateNetworkUrl(apiBaseUrl);

  if (isProductionLike && isPrivateNetworkApi) {
    const privateMessage =
      "VITE_API_BASE_URL cannot point to localhost or private network addresses in production environments";
    // eslint-disable-next-line no-console
    console.error(privateMessage);
    throw new Error(privateMessage);
  }

  return apiBaseUrl;
};
