interface Env {
  API_BASE_URL?: string;
  VITE_API_BASE_URL?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  DEPLOY_ENV?: string;
}

const normalize = (value: string | undefined): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed;
};

const normalizeUrl = (value: string | undefined): string => {
  const normalized = normalize(value);
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

export const onRequestGet = ({ env }: { env: Env }) => {
  const apiBaseUrl = normalizeUrl(env.API_BASE_URL ?? env.VITE_API_BASE_URL);
  const googleMapsApiKey = normalize(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const deployEnv = normalize(env.DEPLOY_ENV);

  const payload = {
    apiBaseUrl: apiBaseUrl || undefined,
    env: deployEnv || undefined,
    googleMapsApiKey: googleMapsApiKey || undefined,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
