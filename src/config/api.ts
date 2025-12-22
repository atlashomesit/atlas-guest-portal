const readEnv = (key: string): string | undefined => {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env ?? {} : {};
  const nodeEnv = typeof process !== "undefined" ? (process as any).env ?? {} : {};
  const value = metaEnv?.[key] ?? nodeEnv?.[key];
  return typeof value === "string" ? value : undefined;
};

const normalizeApiBaseUrl = (value: string | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const rawApiBaseUrl = readEnv("VITE_API_BASE_URL");
const normalizedApiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);

if (!normalizedApiBaseUrl) {
  // eslint-disable-next-line no-console
  console.error("VITE_API_BASE_URL is not configured");
}

const isProd = typeof import.meta !== "undefined" ? Boolean((import.meta as any).env?.PROD) : false;
const isLocalhostApi = /localhost/i.test(normalizedApiBaseUrl);

if (isProd && isLocalhostApi) {
  // eslint-disable-next-line no-console
  console.error("VITE_API_BASE_URL cannot point to localhost in production environments");
}

export const API_BASE_URL = isProd && isLocalhostApi ? "" : normalizedApiBaseUrl;
export const IS_API_BASE_CONFIGURED = Boolean(API_BASE_URL);
