declare global {
  interface Window {
    __ATLAS_RUNTIME_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

const normalize = (value: string | undefined): string => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export const getApiBaseUrl = (): string => {
  const runtimeValue = typeof window !== "undefined"
    ? window.__ATLAS_RUNTIME_CONFIG__?.apiBaseUrl
    : undefined;
  const envValue = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE_URL : undefined;

  return normalize(runtimeValue || envValue || "");
};

export default getApiBaseUrl;
