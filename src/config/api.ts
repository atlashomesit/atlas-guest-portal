import { getApiBaseUrl } from "./getApiBaseUrl";

let apiBaseUrl = "";

try {
  apiBaseUrl = getApiBaseUrl();
} catch (error) {
  // Errors are logged inside getApiBaseUrl; exporting an empty string keeps the UI fallback intact.
}

export const API_BASE_URL = apiBaseUrl;
export const IS_API_BASE_CONFIGURED = Boolean(API_BASE_URL);
export { getApiBaseUrl };
