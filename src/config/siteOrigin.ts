/**
 * Canonical site origin for JSON-LD and absolute links when `window` is unavailable (SSR/prerender).
 * Set `VITE_PUBLIC_SITE_ORIGIN` in Cloudflare Pages (e.g. https://www.example.com) for white-label builds.
 */
export function getPublicSiteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_ORIGIN as string | undefined;
  const trimmed = raw?.trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://atlashomestays.com";
}
