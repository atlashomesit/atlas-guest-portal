/** Listing imagery for this product ships from this account (public-read container). */
const ALLOWED_AZURE_BLOB_HOSTS = new Set(["atlashomestorage.blob.core.windows.net"]);

/** Same-origin Cloudflare Pages Function — TASK-7821 transforming CDN. */
export const GUEST_IMAGE_PROXY_PATH = "/img";

export const GUEST_IMAGE_SRCSET_WIDTHS = [480, 768, 1200] as const;

/**
 * Block arbitrary Azure blob hosts (private tenants / accidental URLs). Allow the
 * canonical listing-images account so cards and galleries can load real photos.
 */
export function isBlockedGuestImageUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return true;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const u = new URL(t, base);
    if (!u.hostname.includes("blob.core.windows.net")) return false;
    return !ALLOWED_AZURE_BLOB_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function sanitizeGuestImageUrl(url: string | undefined | null): string | undefined {
  const s = (url ?? "").trim();
  if (!s) return undefined;
  if (isBlockedGuestImageUrl(s)) return undefined;
  return s;
}

export function filterGuestImageUrls(urls: readonly string[] | undefined | null): string[] {
  if (!urls?.length) return [];
  return urls.map((s) => s.trim()).filter(Boolean).filter((u) => !isBlockedGuestImageUrl(u));
}

function isAllowlistedBlobUrl(url: string): boolean {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const u = new URL(url, base);
    return ALLOWED_AZURE_BLOB_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/**
 * TASK-7821: rewrite an allowlisted Azure blob URL through the same-origin `/img`
 * proxy so Cloudflare Image Resizing actually transforms bytes. Query-param
 * `?w=` on the blob host is a no-op (TASK-7433) — never emit that as the src.
 *
 * Non-blob URLs are returned unchanged (still gated by sanitize).
 */
export function toTransformedGuestImageUrl(
  url: string | undefined | null,
  width?: number,
): string | undefined {
  const safe = sanitizeGuestImageUrl(url);
  if (!safe) return undefined;
  if (!isAllowlistedBlobUrl(safe)) return safe;
  const params = new URLSearchParams();
  params.set("u", safe);
  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    params.set("w", String(Math.round(width)));
  }
  return `${GUEST_IMAGE_PROXY_PATH}?${params.toString()}`;
}

/** Responsive srcset against the transforming proxy — never against the raw blob. */
export function buildGuestImageSrcSet(
  url: string | undefined | null,
  widths: readonly number[] = GUEST_IMAGE_SRCSET_WIDTHS,
): string | undefined {
  const safe = sanitizeGuestImageUrl(url);
  if (!safe || !isAllowlistedBlobUrl(safe)) return undefined;
  return widths
    .map((width) => `${toTransformedGuestImageUrl(safe, width)} ${width}w`)
    .join(", ");
}
