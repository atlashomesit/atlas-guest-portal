export const onRequestGet = ({ env }) => {
  const normalize = (value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed;
  };

  const normalizeUrl = (value) => {
    const normalized = normalize(value);
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  };

  const apiBaseUrl = normalizeUrl(env?.VITE_API_BASE_URL);
  const googleMapsApiKey = normalize(env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const missingApiBaseComment = apiBaseUrl
    ? ""
    : "// VITE_API_BASE_URL is missing from Cloudflare Pages environment variables.\n";

  const missingMapsKeyComment = googleMapsApiKey
    ? ""
    : "// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing from Cloudflare Pages environment variables.\n";

  const body = `${missingApiBaseComment}${missingMapsKeyComment}window.__ATLAS_RUNTIME_CONFIG__ = { apiBaseUrl: ${JSON.stringify(
    apiBaseUrl,
  )}, googleMapsApiKey: ${JSON.stringify(googleMapsApiKey)} };\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
