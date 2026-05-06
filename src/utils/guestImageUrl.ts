/** Listing imagery from Atlas accounts (public-read containers). Includes both tenant and platform images. */
const ALLOWED_AZURE_BLOB_HOSTS = new Set([
  "atlashomestorage.blob.core.windows.net",
  "atlasplatform.blob.core.windows.net",
  "atlasstg.blob.core.windows.net",
]);

/**
 * Block arbitrary Azure blob hosts (private tenants / accidental URLs). Allow Atlas-owned
 * listing-images accounts (tenant and platform) so cards and galleries can load real photos.
 */
export function isBlockedGuestImageUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return true;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const u = new URL(t, base);
    if (!u.hostname.includes("blob.core.windows.net")) return false;
    // Allow known Atlas storage accounts and any account starting with "atlas"
    return !ALLOWED_AZURE_BLOB_HOSTS.has(u.hostname) && !u.hostname.startsWith("atlas");
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
