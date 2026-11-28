import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsDown, ThumbsUp, Share2, Copy, Plus } from 'lucide-react';
import {
  addWishlistItemNote,
  buildWishlistInviteUrl,
  countVotes,
  createTripWishlist,
  getTripWishlists,
  importSharedWishlistPayload,
  MAX_WISHLIST_NOTE_LEN,
  updateTripWishlistTrip,
  voteWishlistItem,
  type TripWishlist,
} from '@/utils/tripWishlists';
import { estimateStayNights, formatEstTotalInclGst } from '@/utils/guestPriceEstimate';
import { clampMin, toEditableInt } from '@/utils/numericInput';

export type WishlistListingMeta = {
  id: number;
  title: string;
  city?: string;
  tenantSlug?: string;
  pricePerNight?: number;
  href: string;
};

interface CollaborativeTripWishlistBoardProps {
  shareToken?: string;
  encodedData?: string | null;
  listingsById: Map<number, WishlistListingMeta>;
  formatMoney: (inr: number) => string;
  processingFeePercent?: number;
}

export const CollaborativeTripWishlistBoard: React.FC<CollaborativeTripWishlistBoardProps> = ({
  shareToken,
  encodedData,
  listingsById,
  formatMoney,
  processingFeePercent = 0,
}) => {
  const [epoch, setEpoch] = useState(0);
  const [newListTitle, setNewListTitle] = useState('');
  const [participantName, setParticipantName] = useState('You');
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [guestsDraft, setGuestsDraft] = useState<number | '' | null>(null);

  const wishlists = useMemo<TripWishlist[]>(() => {
    void epoch;
    if (shareToken) {
      importSharedWishlistPayload(shareToken, encodedData ?? null);
    }
    return getTripWishlists();
  }, [epoch, shareToken, encodedData]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeWishlist = useMemo(() => {
    if (shareToken) {
      const byToken = wishlists.find((w) => w.shareToken === shareToken);
      if (byToken) return byToken;
    }
    if (selectedId) {
      const byId = wishlists.find((w) => w.id === selectedId);
      if (byId) return byId;
    }
    return wishlists[0] ?? null;
  }, [wishlists, shareToken, selectedId]);

  const nights = estimateStayNights(
    activeWishlist?.checkIn ? new Date(activeWishlist.checkIn) : null,
    activeWishlist?.checkOut ? new Date(activeWishlist.checkOut) : null,
  );

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    const created = createTripWishlist(newListTitle.trim());
    setNewListTitle('');
    setSelectedId(created.id);
    setEpoch((n) => n + 1);
  };

  const handleCopyInvite = async (wl: TripWishlist) => {
    const url = buildWishlistInviteUrl(wl, window.location.origin);
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // Clipboard may be unavailable in headless tests
    }
    setCopiedId(wl.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (wl: TripWishlist) => {
    const url = buildWishlistInviteUrl(wl, window.location.origin);
    const text = `Join our trip wishlist "${wl.title}" on Atlas Stays and vote on stays: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      className="rounded-2xl border border-border-subtle bg-bg-surface p-4 sm:p-6 space-y-5"
      data-testid="collaborative-trip-wishlists"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Collaborative trip wishlists</h2>
          <p className="text-xs text-text-muted">
            Plan trips together — vote stays up or down, add shared notes, and sync trip dates.
          </p>
        </div>

        <form onSubmit={handleCreateList} className="flex flex-wrap items-center gap-2" data-testid="create-trip-wishlist-form">
          <input
            type="text"
            aria-label="New trip list name"
            data-testid="new-trip-wishlist-title"
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            placeholder="e.g. Goa NYE 2026"
            maxLength={80}
            className="min-h-[44px] rounded-xl border border-border px-3 py-2 text-sm text-text-primary"
          />
          <button
            type="submit"
            data-testid="create-trip-wishlist-btn"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New trip list
          </button>
        </form>
      </div>

      {wishlists.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Trip wishlists">
          {wishlists.map((wl) => {
            const active = activeWishlist?.id === wl.id;
            return (
              <button
                key={wl.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`trip-wishlist-tab-${wl.id}`}
                onClick={() => setSelectedId(wl.id)}
                className={`min-h-[44px] rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'border-black bg-black text-white'
                    : 'border-border bg-bg-surface text-text-primary hover:border-text-primary'
                }`}
              >
                {wl.title} ({wl.items.length})
              </button>
            );
          })}
        </div>
      )}

      {activeWishlist && (
        <div className="space-y-4 border-t border-border-subtle pt-4" data-testid="active-trip-wishlist-board">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="wl-checkin" className="block text-xs font-semibold text-text-muted">
                  Check-in
                </label>
                <input
                  id="wl-checkin"
                  data-testid="wishlist-shared-checkin"
                  type="date"
                  value={activeWishlist.checkIn ?? ''}
                  onChange={(e) => {
                    updateTripWishlistTrip(activeWishlist.id, { checkIn: e.target.value });
                    setEpoch((n) => n + 1);
                  }}
                  className="mt-1 min-h-[44px] rounded-xl border border-border px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="wl-checkout" className="block text-xs font-semibold text-text-muted">
                  Check-out
                </label>
                <input
                  id="wl-checkout"
                  data-testid="wishlist-shared-checkout"
                  type="date"
                  value={activeWishlist.checkOut ?? ''}
                  onChange={(e) => {
                    updateTripWishlistTrip(activeWishlist.id, { checkOut: e.target.value });
                    setEpoch((n) => n + 1);
                  }}
                  className="mt-1 min-h-[44px] rounded-xl border border-border px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="wl-guests" className="block text-xs font-semibold text-text-muted">
                  Guests
                </label>
                <input
                  id="wl-guests"
                  data-testid="wishlist-shared-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={guestsDraft !== null ? guestsDraft : activeWishlist.guests}
                  onChange={(e) => {
                    const parsed = toEditableInt(e.target.value);
                    setGuestsDraft(parsed);
                    if (parsed !== '') {
                      updateTripWishlistTrip(activeWishlist.id, { guests: clampMin(parsed, 1) });
                      setEpoch((n) => n + 1);
                    }
                  }}
                  onBlur={() => {
                    if (guestsDraft !== null) {
                      updateTripWishlistTrip(activeWishlist.id, { guests: clampMin(guestsDraft, 1) });
                      setGuestsDraft(null);
                      setEpoch((n) => n + 1);
                    }
                  }}
                  className="mt-1 min-h-[44px] w-20 rounded-xl border border-border px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="wl-participant" className="block text-xs font-semibold text-text-muted">
                  Your name
                </label>
                <input
                  id="wl-participant"
                  data-testid="wishlist-participant-name"
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  maxLength={40}
                  className="mt-1 min-h-[44px] w-32 rounded-xl border border-border px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="wishlist-copy-invite"
                onClick={() => handleCopyInvite(activeWishlist)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-bg-muted"
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copiedId === activeWishlist.id ? 'Invite link copied!' : 'Copy invite link'}
              </button>
              <button
                type="button"
                data-testid="wishlist-share-whatsapp"
                onClick={() => handleShareWhatsApp(activeWishlist)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share on WhatsApp
              </button>
            </div>
          </div>

          {activeWishlist.items.length === 0 ? (
            <p className="text-sm text-text-muted">
              No stays in &ldquo;{activeWishlist.title}&rdquo; yet. Tap the heart on any listing on Atlas Stays to add it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeWishlist.items.map((item) => {
                const meta = listingsById.get(item.listingId);
                const { up, down } = countVotes(item.votes);
                const myVote = item.votes[participantName.trim() || 'Guest'];
                const estTotal =
                  meta?.pricePerNight && meta.pricePerNight > 0
                    ? formatEstTotalInclGst(meta.pricePerNight, nights, formatMoney, processingFeePercent)
                    : null;

                return (
                  <div
                    key={item.listingId}
                    data-testid={`trip-wishlist-card-${item.listingId}`}
                    className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={meta?.href ?? `/favorites`}
                          className="text-sm font-semibold text-text-primary hover:underline"
                        >
                          {meta?.title ?? item.title ?? `Stay #${item.listingId}`}
                        </Link>
                        {meta?.city && <p className="text-xs text-text-muted">{meta.city}</p>}
                        {estTotal && (
                          <p className="mt-1 text-xs font-semibold text-emerald-700" data-testid={`trip-wishlist-quote-${item.listingId}`}>
                            {estTotal} ({nights} {nights === 1 ? 'night' : 'nights'})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-pressed={myVote === 'up'}
                          data-testid={`wishlist-vote-up-${item.listingId}`}
                          onClick={() => {
                            voteWishlistItem(activeWishlist.id, item.listingId, participantName, 'up');
                            setEpoch((n) => n + 1);
                          }}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                            myVote === 'up'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                              : 'border-border text-text-primary hover:bg-bg-muted'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                          <span>{up}</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={myVote === 'down'}
                          data-testid={`wishlist-vote-down-${item.listingId}`}
                          onClick={() => {
                            voteWishlistItem(activeWishlist.id, item.listingId, participantName, 'down');
                            setEpoch((n) => n + 1);
                          }}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                            myVote === 'down'
                              ? 'border-rose-600 bg-rose-50 text-rose-800'
                              : 'border-border text-text-primary hover:bg-bg-muted'
                          }`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                          <span>{down}</span>
                        </button>
                      </div>
                    </div>

                    {item.notes.length > 0 && (
                      <ul className="space-y-1.5 border-t border-border-subtle pt-2 text-xs text-text-body">
                        {item.notes.map((n) => (
                          <li key={n.id} className="rounded-lg bg-bg-muted px-2.5 py-1.5">
                            <span className="font-semibold text-text-primary">{n.author}:</span> {n.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const text = (noteDrafts[item.listingId] ?? '').trim();
                        if (!text) return;
                        addWishlistItemNote(activeWishlist.id, item.listingId, participantName, text);
                        setNoteDrafts((prev) => ({ ...prev, [item.listingId]: '' }));
                        setEpoch((n) => n + 1);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        aria-label="Add shared note"
                        data-testid={`wishlist-note-input-${item.listingId}`}
                        maxLength={MAX_WISHLIST_NOTE_LEN}
                        value={noteDrafts[item.listingId] ?? ''}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [item.listingId]: e.target.value }))
                        }
                        placeholder="Add a note for your group…"
                        className="min-h-[44px] flex-1 rounded-lg border border-border px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        data-testid={`wishlist-note-submit-${item.listingId}`}
                        className="min-h-[44px] rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Add note
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CollaborativeTripWishlistBoard;
