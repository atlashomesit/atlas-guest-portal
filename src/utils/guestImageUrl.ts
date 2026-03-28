/**
 * Azure Blob URLs are not publicly readable for this project (409). Never use them as img src
 * in the guest portal — filter them out and show a grey placeholder instead.
 */
export function isBlockedGuestImageUrl(url: string): boolean {
  const t = (url ?? "").trim();
  if (!t) return true;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const u = new URL(t, base);
    return u.hostname.includes("blob.core.windows.net");
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
