import { getApiBaseUrl as getApiBaseUrlFromRuntime } from "@/runtime-config";

export const getApiBaseUrl = (): string => getApiBaseUrlFromRuntime();

export const getApiBaseUrlSafe = (): string => {
  try {
    return getApiBaseUrlFromRuntime();
  } catch {
    return "";
  }
};

export const isApiBaseConfigured = (): boolean => Boolean(getApiBaseUrlSafe());
