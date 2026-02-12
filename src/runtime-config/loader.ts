import type { AtlasRuntimeConfig } from "./types";

const PREFERRED_URL = "/.well-known/atlas-runtime-config.json";

function isLocalDev(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = (window.location?.hostname ?? "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local");
}

function isValidHttpUrl(s: string): boolean {
  const trimmed = typeof s === "string" ? s.trim() : "";
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateConfig(raw: unknown): { ok: true; config: AtlasRuntimeConfig } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Config is not an object" };
  }
  const obj = raw as Record<string, unknown>;

  const apiBaseUrl = typeof obj.apiBaseUrl === "string" ? obj.apiBaseUrl.trim() : "";
  if (!apiBaseUrl) {
    return { ok: false, reason: "apiBaseUrl is required and must be a non-empty string" };
  }
  if (!isValidHttpUrl(apiBaseUrl)) {
    return { ok: false, reason: "apiBaseUrl must be a valid http or https URL" };
  }

  let globalDiscountPercent: number | undefined;
  if (obj.globalDiscountPercent !== undefined && obj.globalDiscountPercent !== null) {
    const n = Number(obj.globalDiscountPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ok: false, reason: "globalDiscountPercent must be a number between 0 and 100" };
    }
    globalDiscountPercent = n;
  }

  let googleMapsApiKey: string | undefined;
  if (obj.googleMapsApiKey !== undefined && obj.googleMapsApiKey !== null) {
    const s = String(obj.googleMapsApiKey).trim();
    if (s) googleMapsApiKey = s;
  }

  const environment = typeof obj.environment === "string" ? obj.environment.trim() || undefined : undefined;
  const tenantKey = typeof obj.tenantKey === "string" ? obj.tenantKey.trim() || undefined : undefined;

  const config: AtlasRuntimeConfig = {
    apiBaseUrl: apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl,
    globalDiscountPercent,
    environment,
    tenantKey,
    googleMapsApiKey,
  };
  return { ok: true, config };
}

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function loadRuntimeConfig(): Promise<AtlasRuntimeConfig> {
  const tryUrl = async (url: string): Promise<Response> => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return fetch(`${base}${url}`, { cache: "no-store" });
  };

  const response = await tryUrl(PREFERRED_URL);
  if (!response.ok) {
    const msg = "Runtime config missing/invalid";
    if (!isLocalDev()) throw new Error(msg);
    throw new Error(`${msg}: failed to load config (${response.status})`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    const msg = "Runtime config missing/invalid";
    if (!isLocalDev()) throw new Error(msg);
    throw new Error(`${msg}: invalid JSON`);
  }

  const result = validateConfig(data);
  if (!result.ok) {
    const msg = "Runtime config missing/invalid";
    if (!isLocalDev()) throw new Error(msg);
    throw new Error(`${msg}: ${result.reason}`);
  }

  const { config } = result;
  if (isLocalDev() && !isLocalhostUrl(config.apiBaseUrl)) {
    throw new Error(
      "Runtime config missing/invalid: in local dev, apiBaseUrl must be a localhost URL (e.g. http://localhost:5000)",
    );
  }

  return config;
}
