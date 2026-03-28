import { getApiBaseUrl } from "@/runtime-config";
import { isAtlasApiRequest, logApiError, monitoredFetch } from "./monitoring";

type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
  url: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}${path}`;
  try {
    const response = await monitoredFetch(url, {
      ...init,
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: init?.credentials ?? "include",
      requestName: path,
    });

    const ct = response.headers.get("content-type") ?? "";
    const preview = await response.text();

    if (!ct.includes("application/json")) {
      logApiError(new Error("Non-JSON response from API"), {
        url: response.url,
        method: init?.method ?? "GET",
        responseSnippet: preview.slice(0, 120),
        category: "http",
        tags: { atlasApi: String(isAtlasApiRequest(response.url)) },
      });
    }

    const data = ct.includes("application/json") ? (JSON.parse(preview) as T) : (preview as unknown as T);

    if (!response.ok) {
      throw new Error("We were unable to load data. Please try again in a few moments.");
    }

    return { data, status: response.status, headers: response.headers, url: response.url };
  } catch (error) {
    logApiError(error, {
      url,
      method: init?.method ?? "GET",
      requestName: path,
      category: "network",
      tags: { atlasApi: String(isAtlasApiRequest(url)) },
    });
    throw error instanceof Error ? error : new Error("Unexpected error while reaching the API.");
  }
}

export const api = {
  get<T = unknown>(path: string, init?: RequestInit) {
    return request<T>(path, { ...init, method: "GET" });
  },
};

// Helper to ensure arrays before .map()
export function asArray<T>(val: unknown, label: string): T[] {
  if (Array.isArray(val)) return val as T[];
  console.error(`${label} expected array, got:`, val);
  return [];
}
