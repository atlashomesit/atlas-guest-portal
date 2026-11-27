import { beforeEach, describe, expect, it } from 'vitest';
import {
  addWishlistItemNote,
  buildWishlistInviteUrl,
  countVotes,
  createTripWishlist,
  getTripWishlists,
  importSharedWishlistPayload,
  MAX_WISHLIST_NOTE_LEN,
  toggleListingInTripWishlist,
  updateTripWishlistTrip,
  voteWishlistItem,
} from './tripWishlists';

describe('tripWishlists (MKT-069)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a named trip wishlist, saves stays, votes up/down, adds notes, and updates dates', () => {
    const wl = createTripWishlist('Goa NYE 2026', { checkIn: '2026-12-30', checkOut: '2027-01-02', guests: 4 });
    expect(wl.title).toBe('Goa NYE 2026');
    expect(wl.guests).toBe(4);

    const { added } = toggleListingInTripWishlist(wl.id, { listingId: 101, tenantSlug: 'goa-villas', title: 'Palm Villa' });
    expect(added).toBe(true);

    voteWishlistItem(wl.id, 101, 'Ananya', 'up');
    voteWishlistItem(wl.id, 101, 'Rohan', 'down');
    const afterVotes = getTripWishlists().find((w) => w.id === wl.id)!;
    expect(countVotes(afterVotes.items[0].votes)).toEqual({ up: 1, down: 1 });

    // Toggle same vote off (idempotency)
    voteWishlistItem(wl.id, 101, 'Ananya', 'up');
    const afterToggle = getTripWishlists().find((w) => w.id === wl.id)!;
    expect(countVotes(afterToggle.items[0].votes)).toEqual({ up: 0, down: 1 });

    const longNote = 'x'.repeat(MAX_WISHLIST_NOTE_LEN + 50);
    addWishlistItemNote(wl.id, 101, 'Ananya', longNote);
    const afterNote = getTripWishlists().find((w) => w.id === wl.id)!;
    expect(afterNote.items[0].notes).toHaveLength(1);
    expect(afterNote.items[0].notes[0].text).toHaveLength(MAX_WISHLIST_NOTE_LEN);

    updateTripWishlistTrip(wl.id, { checkIn: '2026-12-31', checkOut: '2027-01-03', guests: 6 });
    const afterUpdate = getTripWishlists().find((w) => w.id === wl.id)!;
    expect(afterUpdate.checkIn).toBe('2026-12-31');
    expect(afterUpdate.guests).toBe(6);

    const inviteUrl = buildWishlistInviteUrl(afterUpdate, 'https://atlastays.com');
    expect(inviteUrl).toContain(`/wishlists/${afterUpdate.shareToken}?data=`);
    const url = new URL(inviteUrl);
    window.localStorage.clear();
    const imported = importSharedWishlistPayload(afterUpdate.shareToken, url.searchParams.get('data'));
    expect(imported?.title).toBe('Goa NYE 2026');
    expect(imported?.items.map((i) => i.listingId)).toEqual([101]);
  });
});
