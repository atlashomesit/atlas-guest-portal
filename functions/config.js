export const onRequestGet = ({ env }) => {
  const rawValue = typeof env?.VITE_API_BASE_URL === "string" ? env.VITE_API_BASE_URL : "";
  const trimmed = rawValue.trim();
  const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  const apiBaseUrl = normalized;
  const missingComment = apiBaseUrl ? "" : "// VITE_API_BASE_URL is missing from Cloudflare Pages environment variables.\n";

  const body = `${missingComment}window.__ATLAS_RUNTIME_CONFIG__ = { apiBaseUrl: ${JSON.stringify(apiBaseUrl)} };\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
