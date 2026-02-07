import { getApiBaseUrl } from "./getApiBaseUrl";

export const getApiBaseUrlSafe = (): string => {
  try {
    return getApiBaseUrl();
  } catch (error) {
    // Errors are logged inside getApiBaseUrl; returning an empty string keeps the UI fallback intact.
    return "";
  }
};

export const isApiBaseConfigured = (): boolean => Boolean(getApiBaseUrlSafe());
export { getApiBaseUrl };
