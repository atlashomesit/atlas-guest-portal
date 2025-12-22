import axios from "axios";
import { API_BASE_URL } from "@/config/api";

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
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
