import { buildApiUrl, getApiHeaders } from "../api/client";
import { getCachedGuestAuthState } from "../storage/guestAuthStorage";

const RECENT_KEY = "atlas_recent_listings_v1";
const FAV_KEY = "atlas_favorites_v1";

/** TASK-4515: track if we've synced favorites this session to avoid redundant API calls */
let favoritesSynced = false;
/** GUEST-009: track if we've synced recently viewed listings this session */
let recentlyViewedSynced = false;

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
  // GUEST-009: sync to server if guest is authenticated
  if (getCachedGuestAuthState()?.isAuthenticated) {
    syncRecentlyViewedToServer(deduped).catch(() => { /* non-critical — fire and forget */ });
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
  // TASK-103034: delete server-side if guest is authenticated
  if (getCachedGuestAuthState()?.isAuthenticated) {
    fetch(buildApiUrl(`/api/guest/recently-viewed/${listingId}`), {
      method: "DELETE",
      headers: getApiHeaders(),
    }).catch(() => { /* non-critical — fire and forget */ });
  }
}

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem("atlas_recently_viewed");
  } catch {
    /* ignore quota / private mode */
  }
  try {
    window.dispatchEvent(new CustomEvent("atlas-recently-viewed-changed"));
  } catch {
    /* non-browser */
  }
  // TASK-103034: delete server-side if guest is authenticated
  if (getCachedGuestAuthState()?.isAuthenticated) {
    fetch(buildApiUrl("/api/guest/recently-viewed"), {
      method: "DELETE",
      headers: getApiHeaders(),
    }).catch(() => { /* non-critical — fire and forget */ });
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

/** GUEST-009: sync recently viewed listings to server for authenticated guest */
export async function syncRecentlyViewedToServer(items: GuestListingHistoryItem[]): Promise<void> {
  try {
    const payload = {
      items: items.map((x) => ({
        listingId: x.listingId,
        viewedAtUtc: x.viewedAtUtc,
      })),
    };
    const response = await fetch(buildApiUrl("/api/guest/recently-viewed"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getApiHeaders() },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn("Failed to sync recently viewed to server:", response.statusText);
    }
  } catch (err) {
    console.warn("Failed to sync recently viewed to server:", err);
  }
}

/**
 * GUEST-009: load recently viewed listings from server if guest is authenticated.
 * Merges server + local items, deduplicates by listingId (keeping latest timestamp),
 * caps at 24 newest items, updates localStorage, and syncs merged items back to server.
 */
export async function loadRecentlyViewedIfAuthenticated(): Promise<void> {
  if (recentlyViewedSynced || !getCachedGuestAuthState()?.isAuthenticated) return;
  recentlyViewedSynced = true;

  try {
    const response = await fetch(buildApiUrl("/api/guest/recently-viewed"), {
      headers: getApiHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      const serverItems = (data.items ?? []) as Array<{ listingId: number; viewedAtUtc: string }>;
      const localItems = getRecentlyViewed();

      const localMap = new Map<number, GuestListingHistoryItem>();
      for (const item of localItems) {
        localMap.set(item.listingId, item);
      }

      const mergedMap = new Map<number, GuestListingHistoryItem>();
      for (const s of serverItems) {
        const existing = localMap.get(s.listingId);
        if (existing) {
          const sTime = new Date(s.viewedAtUtc).getTime();
          const lTime = new Date(existing.viewedAtUtc).getTime();
          mergedMap.set(s.listingId, {
            ...existing,
            viewedAtUtc: sTime > lTime ? s.viewedAtUtc : existing.viewedAtUtc,
          });
        } else {
          // TASK-103034: resolve listing's /homes/:propertySlug/:unitSlug path or omit when unresolvable
          const sObj = s as any;
          const resolvedPath = typeof sObj.path === "string" && sObj.path.startsWith("/homes/")
            ? sObj.path
            : (sObj.propertySlug && sObj.unitSlug)
              ? `/homes/${sObj.propertySlug}/${sObj.unitSlug}`
              : null;

          if (resolvedPath) {
            mergedMap.set(s.listingId, {
              listingId: s.listingId,
              path: resolvedPath,
              name: sObj.name,
              coverPhotoUrl: sObj.coverPhotoUrl,
              location: sObj.location,
              pricePerNight: sObj.pricePerNight,
              viewedAtUtc: s.viewedAtUtc,
            });
          }
        }
      }

      for (const l of localItems) {
        if (!mergedMap.has(l.listingId)) {
          mergedMap.set(l.listingId, l);
        }
      }

      const merged = Array.from(mergedMap.values())
        .sort((a, b) => new Date(b.viewedAtUtc).getTime() - new Date(a.viewedAtUtc).getTime())
        .slice(0, 24);

      localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
      try {
        window.dispatchEvent(new CustomEvent("atlas-recently-viewed-changed"));
      } catch {
        /* non-browser */
      }

      if (localItems.length > 0) {
        syncRecentlyViewedToServer(merged).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("Failed to load server recently viewed:", err);
  }
}

/**
 * TASK-103034: reset local recently-viewed state and sync flag on logout so accounts don't leak history
 */
export function resetRecentlyViewedOnLogout(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem("atlas_recently_viewed");
  } catch {
    /* ignore */
  }
  recentlyViewedSynced = false;
  try {
    window.dispatchEvent(new CustomEvent("atlas-recently-viewed-changed"));
  } catch {
    /* non-browser */
  }
}

/** Reset sync flag for unit testing */
export function _resetRecentlyViewedSyncedForTesting(): void {
  recentlyViewedSynced = false;
}

