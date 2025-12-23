import { API_BASE_URL } from "@/config/api";

type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
  url: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL ?? ""}${path}`;
  const response = await fetch(url, {
    ...init,
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: init?.credentials ?? "include",
  });

  const ct = response.headers.get("content-type") ?? "";
  const preview = await response.text();

  if (!ct.includes("application/json")) {
    // eslint-disable-next-line no-console
    console.error("Non-JSON response from API", { url: response.url, ct, preview: preview.slice(0, 120) });
  }

  const data = ct.includes("application/json") ? (JSON.parse(preview) as T) : (preview as unknown as T);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return { data, status: response.status, headers: response.headers, url: response.url };
}

export const api = {
  get<T = unknown>(path: string, init?: RequestInit) {
    return request<T>(path, { ...init, method: "GET" });
  },
};

// Helper to ensure arrays before .map()
export function asArray<T>(val: unknown, label: string): T[] {
  if (Array.isArray(val)) return val as T[];
  // eslint-disable-next-line no-console
  console.error(`${label} expected array, got:`, val);
  return [];
}
