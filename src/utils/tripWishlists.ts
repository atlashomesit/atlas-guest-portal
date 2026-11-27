export type TripWishlistVoteDirection = 'up' | 'down';

export type TripWishlistNote = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type TripWishlistItem = {
  listingId: number;
  tenantSlug?: string;
  title?: string;
  votes: Record<string, TripWishlistVoteDirection>;
  notes: TripWishlistNote[];
};

export type TripWishlist = {
  id: string;
  shareToken: string;
  title: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  items: TripWishlistItem[];
  updatedAt: string;
};

const STORAGE_KEY = 'atlas_trip_wishlists_v1';
export const MAX_WISHLIST_NOTE_LEN = 300;

function generateToken(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `wl_${Date.now().toString(36)}_${rand}`;
}

export function getTripWishlists(): TripWishlist[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TripWishlist[]) : [];
  } catch {
    return [];
  }
}

function saveTripWishlists(lists: TripWishlist[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // Ignore storage quota errors
  }
}

export function getTripWishlistByToken(shareToken: string): TripWishlist | null {
  return getTripWishlists().find((w) => w.shareToken === shareToken) ?? null;
}

export function createTripWishlist(
  title: string,
  options?: { checkIn?: string; checkOut?: string; guests?: number },
): TripWishlist {
  const trimmed = title.trim().slice(0, 80) || 'My Trip';
  const now = new Date().toISOString();
  const created: TripWishlist = {
    id: generateToken(),
    shareToken: generateToken(),
    title: trimmed,
    checkIn: options?.checkIn || undefined,
    checkOut: options?.checkOut || undefined,
    guests: options?.guests && options.guests > 0 ? Math.min(20, Math.floor(options.guests)) : 2,
    items: [],
    updatedAt: now,
  };
  const all = [created, ...getTripWishlists()];
  saveTripWishlists(all);
  return created;
}

export function updateTripWishlistTrip(
  wishlistId: string,
  patch: { title?: string; checkIn?: string; checkOut?: string; guests?: number },
): TripWishlist | null {
  const all = getTripWishlists();
  let updated: TripWishlist | null = null;
  const next = all.map((w) => {
    if (w.id !== wishlistId) return w;
    updated = {
      ...w,
      title: patch.title !== undefined ? patch.title.trim().slice(0, 80) || w.title : w.title,
      checkIn: patch.checkIn !== undefined ? patch.checkIn || undefined : w.checkIn,
      checkOut: patch.checkOut !== undefined ? patch.checkOut || undefined : w.checkOut,
      guests:
        patch.guests !== undefined && Number.isFinite(patch.guests) && patch.guests > 0
          ? Math.min(20, Math.floor(patch.guests))
          : w.guests,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  saveTripWishlists(next);
  return updated;
}

export function toggleListingInTripWishlist(
  wishlistId: string,
  listing: { listingId: number; tenantSlug?: string; title?: string },
): { wishlist: TripWishlist | null; added: boolean } {
  const all = getTripWishlists();
  let updated: TripWishlist | null = null;
  let added = false;
  const next = all.map((w) => {
    if (w.id !== wishlistId) return w;
    const exists = w.items.some((it) => it.listingId === listing.listingId);
    const items = exists
      ? w.items.filter((it) => it.listingId !== listing.listingId)
      : [
          ...w.items,
          {
            listingId: listing.listingId,
            tenantSlug: listing.tenantSlug,
            title: listing.title,
            votes: {},
            notes: [],
          },
        ];
    added = !exists;
    updated = { ...w, items, updatedAt: new Date().toISOString() };
    return updated;
  });
  saveTripWishlists(next);
  return { wishlist: updated, added };
}

export function voteWishlistItem(
  wishlistId: string,
  listingId: number,
  participantName: string,
  direction: TripWishlistVoteDirection,
): TripWishlist | null {
  const participant = participantName.trim().slice(0, 40) || 'Guest';
  const all = getTripWishlists();
  let updated: TripWishlist | null = null;
  const next = all.map((w) => {
    if (w.id !== wishlistId) return w;
    const items = w.items.map((it) => {
      if (it.listingId !== listingId) return it;
      const nextVotes = { ...it.votes };
      if (nextVotes[participant] === direction) {
        delete nextVotes[participant];
      } else {
        nextVotes[participant] = direction;
      }
      return { ...it, votes: nextVotes };
    });
    updated = { ...w, items, updatedAt: new Date().toISOString() };
    return updated;
  });
  saveTripWishlists(next);
  return updated;
}

export function addWishlistItemNote(
  wishlistId: string,
  listingId: number,
  author: string,
  text: string,
): TripWishlist | null {
  const cleanText = text.trim().slice(0, MAX_WISHLIST_NOTE_LEN);
  if (!cleanText) return null;
  const cleanAuthor = author.trim().slice(0, 40) || 'Guest';
  const all = getTripWishlists();
  let updated: TripWishlist | null = null;
  const next = all.map((w) => {
    if (w.id !== wishlistId) return w;
    const items = w.items.map((it) => {
      if (it.listingId !== listingId) return it;
      const note: TripWishlistNote = {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        author: cleanAuthor,
        text: cleanText,
        createdAt: new Date().toISOString(),
      };
      return { ...it, notes: [...it.notes, note] };
    });
    updated = { ...w, items, updatedAt: new Date().toISOString() };
    return updated;
  });
  saveTripWishlists(next);
  return updated;
}

export function countVotes(votes: Record<string, TripWishlistVoteDirection>): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const dir of Object.values(votes)) {
    if (dir === 'up') up += 1;
    else if (dir === 'down') down += 1;
  }
  return { up, down };
}

export function buildWishlistInviteUrl(wishlist: TripWishlist, origin: string): string {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          t: wishlist.title,
          ci: wishlist.checkIn,
          co: wishlist.checkOut,
          g: wishlist.guests,
          ids: wishlist.items.map((i) => i.listingId),
        }),
      ),
    ),
  );
  return `${origin}/wishlists/${encodeURIComponent(wishlist.shareToken)}?data=${encodeURIComponent(payload)}`;
}

export function importSharedWishlistPayload(shareToken: string, encodedData: string | null): TripWishlist | null {
  const existing = getTripWishlistByToken(shareToken);
  if (existing) return existing;
  if (!encodedData) return null;
  try {
    const json = decodeURIComponent(escape(atob(encodedData)));
    const parsed = JSON.parse(json) as {
      t?: string;
      ci?: string;
      co?: string;
      g?: number;
      ids?: number[];
    };
    const imported: TripWishlist = {
      id: generateToken(),
      shareToken,
      title: (parsed.t || 'Shared Trip').slice(0, 80),
      checkIn: parsed.ci,
      checkOut: parsed.co,
      guests: parsed.g && parsed.g > 0 ? parsed.g : 2,
      items: Array.isArray(parsed.ids)
        ? parsed.ids
            .filter((n) => typeof n === 'number' && n > 0)
            .map((listingId) => ({ listingId, votes: {}, notes: [] }))
        : [],
      updatedAt: new Date().toISOString(),
    };
    saveTripWishlists([imported, ...getTripWishlists()]);
    return imported;
  } catch {
    return null;
  }
}
