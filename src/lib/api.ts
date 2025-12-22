import axios from "axios";
import { getApiBase } from "../utils/env";

const apiBase = getApiBase();
if (import.meta.env.PROD && !apiBase) {
  // eslint-disable-next-line no-console
  console.error("CONFIG: Missing VITE_API_BASE in production build.");
}

export const api = axios.create({
  baseURL: apiBase,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (res) => {
    const ct = String(res.headers?.["content-type"] || "");
    if (!ct.includes("application/json")) {
      // eslint-disable-next-line no-console
      console.error("Non-JSON response from API", { url: res.config?.url, ct, preview: String(res.data).slice(0, 120) });
    }
    return res;
  },
  (err) => Promise.reject(err)
);

// Helper to ensure arrays before .map()
export function asArray<T>(val: unknown, label: string): T[] {
  if (Array.isArray(val)) return val as T[];
  // eslint-disable-next-line no-console
  console.error(`${label} expected array, got:`, val);
  return [];
}

