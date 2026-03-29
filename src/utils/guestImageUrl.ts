/** Listing imagery for this product ships from this account (public-read container). */
const ALLOWED_AZURE_BLOB_HOSTS = new Set(["atlashomestorage.blob.core.windows.net"]);

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
