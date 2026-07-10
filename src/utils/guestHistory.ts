import { buildApiUrl, getApiHeaders } from "../api/client";
import { getCachedGuestAuthState } from "../storage/guestAuthStorage";

const RECENT_KEY = "atlas_recent_listings_v1";
const FAV_KEY = "atlas_favorites_v1";

/** TASK-4515: track if we've synced favorites this session to avoid redundant API calls */
let favoritesSynced = false;

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
  try {
    window.dispatchEvent(new CustomEvent("atlas-recently-viewed-changed"));
  } catch {
    /* non-browser */
  }
}

export function getRecentlyViewed(): GuestListingHistoryItem[] {
  const list = safeParse<GuestListingHistoryItem[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  return Array.isArray(list) ? list : [];
}

export function removeRecentlyViewed(listingId: number): void {
  const list = safeParse<GuestListingHistoryItem[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  const next = list.filter((x) => x.listingId !== listingId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new CustomEvent("atlas-recently-viewed-changed"));
  } catch {
    /* non-browser */
  }
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
  const adding = !ids.has(listingId);
  if (adding) ids.add(listingId);
  else ids.delete(listingId);
  const next = Array.from(ids).filter((n) => Number.isFinite(n) && n > 0).slice(0, 200);
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new CustomEvent("atlas-favorites-changed"));
  } catch {
    /* non-browser */
  }
  // TASK-4515: sync to server if guest is authenticated
  if (getCachedGuestAuthState()?.isAuthenticated) {
    syncFavoritesToServer(next).catch(() => { /* non-critical — fire and forget */ });
  }
  // TASK-1709: persist save to backend if we have the guest's email (from previous booking).
  else if (adding) {
    try {
      const email = localStorage.getItem("atlas_guest_email");
      if (email) {
        const guestName = localStorage.getItem("atlas_guest_name") ?? undefined;
        fetch(buildApiUrl("/api/saved-listings"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ guestEmail: email, guestName, listingId }),
        }).catch(() => { /* non-critical — fire and forget */ });
      }
    } catch { /* ignore */ }
  }
  return next.includes(listingId);
}

/** TASK-4515: sync favorite listing IDs to authenticated guest account. */
async function syncFavoritesToServer(favoriteIds: number[]): Promise<void> {
  try {
    const response = await fetch(buildApiUrl("/api/saved-listings/account"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getApiHeaders() },
      body: JSON.stringify({ favoriteListingIds: favoriteIds }),
    });
    if (!response.ok) {
      console.warn("Failed to sync favorites to server:", response.statusText);
    }
  } catch (err) {
    console.warn("Failed to sync favorites to server:", err);
  }
}

/**
 * TASK-4515: load favorite listing IDs from server if guest is authenticated (merge server + local).
 * Not yet wired into a call site (e.g. GuestAuthProvider login/hydration) — follow-on work.
 */
export async function loadFavoritesIfAuthenticated(): Promise<void> {
  if (favoritesSynced || !getCachedGuestAuthState()?.isAuthenticated) return;
  favoritesSynced = true;

  try {
    const response = await fetch(buildApiUrl("/api/saved-listings/account"), {
      headers: getApiHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      const serverFavorites = (data.favoriteListingIds ?? []) as number[];
      const localFavorites = getFavoriteIds();
      const merged = Array.from(new Set([...serverFavorites, ...localFavorites]));
      localStorage.setItem(FAV_KEY, JSON.stringify(merged));
      try {
        window.dispatchEvent(new CustomEvent("atlas-favorites-changed"));
      } catch {
        /* non-browser */
      }
    }
  } catch (err) {
    console.warn("Failed to load server favorites:", err);
  }
}

