import type { AtlasRuntimeConfig } from "./types";

let config: AtlasRuntimeConfig | null = null;

export function setRuntimeConfig(c: AtlasRuntimeConfig): void {
  config = c;
}

/** Only for tests: clear the stored config so getRuntimeConfig/getApiBaseUrl throw again. */
export function clearRuntimeConfig(): void {
  config = null;
}

export function getRuntimeConfig(): AtlasRuntimeConfig {
  if (config == null) {
    throw new Error("Runtime config not loaded");
  }
  return config;
}

export function getApiBaseUrl(): string {
  return getRuntimeConfig().apiBaseUrl;
}

export function getGlobalDiscountPercent(): number {
  return getRuntimeConfig().globalDiscountPercent ?? 0;
}

export function getGoogleMapsApiKey(): string | undefined {
  return getRuntimeConfig().googleMapsApiKey;
}

export { loadRuntimeConfig } from "./loader";
export type { AtlasRuntimeConfig } from "./types";
