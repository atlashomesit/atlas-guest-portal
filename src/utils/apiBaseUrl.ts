import { getApiBaseUrlSafe } from "@/config/api";

export const getApiBaseUrl = (): string => getApiBaseUrlSafe();

export default getApiBaseUrl;
