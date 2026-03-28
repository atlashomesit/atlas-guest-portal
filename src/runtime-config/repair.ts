import type { AtlasRuntimeConfig } from "./types";

const HEALTH_PATH = "/health";

async function isHealthy(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}${HEALTH_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Some deployments accidentally configure apiBaseUrl with a trailing "/api"
 * even when the API is mounted at root ("/"). This probes both variants and
 * self-heals to the working one without requiring a frontend redeploy.
 */
export async function repairApiBaseUrl(
  config: AtlasRuntimeConfig,
): Promise<AtlasRuntimeConfig> {
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
  if (!baseUrl.toLowerCase().endsWith("/api")) return config;

  const fallbackBaseUrl = baseUrl.slice(0, -4);
  const [primaryHealthy, fallbackHealthy] = await Promise.all([
    isHealthy(baseUrl),
    isHealthy(fallbackBaseUrl),
  ]);

  if (primaryHealthy || !fallbackHealthy) return config;

  console.warn(
    "[startup] runtime config apiBaseUrl seems to include an invalid /api suffix; falling back to root API base URL",
    { configuredApiBaseUrl: baseUrl, resolvedApiBaseUrl: fallbackBaseUrl },
  );

  return {
    ...config,
    apiBaseUrl: fallbackBaseUrl,
  };
}
