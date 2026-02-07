export interface RuntimeConfig {
  apiBaseUrl?: string;
  googleMapsApiKey?: string;
  env?: string;
}

const CONFIG_ENDPOINT = "/config.json";

const normalizeValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeApiBaseUrl = (value: unknown): string | undefined => {
  const normalized = normalizeValue(value);
  if (!normalized) return undefined;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

const setRuntimeConfig = (config: RuntimeConfig) => {
  if (typeof window === "undefined") return;
  window.__ATLAS_RUNTIME_CONFIG__ = {
    ...(window.__ATLAS_RUNTIME_CONFIG__ ?? {}),
    ...config,
  };
};

export const loadRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (typeof window === "undefined") return {};

  try {
    const response = await fetch(CONFIG_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[runtime-config] Failed to load ${CONFIG_ENDPOINT} (${response.status})`);
      return {};
    }

    const data = (await response.json()) as Record<string, unknown>;
    const runtimeConfig: RuntimeConfig = {
      apiBaseUrl: normalizeApiBaseUrl(data.apiBaseUrl),
      googleMapsApiKey: normalizeValue(data.googleMapsApiKey),
      env: normalizeValue(data.env),
    };

    if (Object.keys(runtimeConfig).length > 0) {
      setRuntimeConfig(runtimeConfig);
    }

    return runtimeConfig;
  } catch (error) {
    console.warn(`[runtime-config] Failed to load ${CONFIG_ENDPOINT}`, error);
    return {};
  }
};
