const RECENT_KEY = "atlas_recent_listings_v1";
const FAV_KEY = "atlas_favorites_v1";

export type GuestListingHistoryItem = {
  listingId: number;
  path: string;
  name?: string;
  coverPhotoUrl?: string;
  location?: string;
  /** TASK-547: nightly price captured at time of view (optional, for display). */
  pricePerNight?: number;
  viewedAtUtc: string;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function addRecentlyViewed(item: Omit<GuestListingHistoryItem, "viewedAtUtc">) {
  const list = safeParse<GuestListingHistoryItem[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  const next: GuestListingHistoryItem = { ...item, viewedAtUtc: new Date().toISOString() };
  const deduped = [next, ...list.filter((x) => x.listingId !== item.listingId)].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(deduped));
}

export function getRecentlyViewed(): GuestListingHistoryItem[] {
  const list = safeParse<GuestListingHistoryItem[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  return Array.isArray(list) ? list : [];
}

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getFavoriteIds(): number[] {
  const ids = safeParse<number[]>(localStorage.getItem(FAV_KEY)) ?? [];
  return Array.isArray(ids) ? ids.filter((n) => Number.isFinite(n)) : [];
}

export function isFavorite(listingId: number): boolean {
  return getFavoriteIds().includes(listingId);
}

export function toggleFavorite(listingId: number): boolean {
  const ids = new Set(getFavoriteIds());
  if (ids.has(listingId)) ids.delete(listingId);
  else ids.add(listingId);
  const next = Array.from(ids).filter((n) => Number.isFinite(n) && n > 0).slice(0, 200);
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next.includes(listingId);
}

