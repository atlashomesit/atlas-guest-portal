import { getApiBaseUrl as getApiBaseUrlStrict } from "../config/getApiBaseUrl";

export const getApiBaseUrl = (): string => {
  try {
    return getApiBaseUrlStrict();
  } catch {
    return "";
  }
};

export default getApiBaseUrl;
