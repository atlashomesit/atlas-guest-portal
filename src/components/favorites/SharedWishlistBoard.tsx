import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../../api/client";
import {
  addTripWishlistNote,
  getTripWishlistByToken,
  voteTripWishlistItem,
} from "../../utils/tripWishlists";

export const SHARED_WISHLIST_MAX_NOTE_LEN = 200;
const VISITOR_SESSION_KEY = "atlas_wishlist_visitor_id_v1";

export interface SharedWishlistNoteDto {
  id: string;
  authorName: string;
  text: string;
  createdAtUtc?: string;
}

export interface SharedWishlistItemDto {
  listingId: number;
  title?: string;
  voteCount: number;
  viewerVoted: boolean;
  notes: SharedWishlistNoteDto[];
}

export interface SharedWishlistBoardDto {
  token: string;
  title: string;
  items: SharedWishlistItemDto[];
}

interface ListingInfo {
  id: number;
  name: string;
  href: string;
  priceLabel?: string;
}

interface SharedWishlistBoardProps {
  boardToken: string;
  listingsById: Map<number, ListingInfo>;
  defaultVisitorName?: string;
}

function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_SESSION_KEY);
    if (existing) return existing;
    const created = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(VISITOR_SESSION_KEY, created);
    return created;
  } catch {
    return "visitor";
  }
}

export const SharedWishlistBoard: React.FC<SharedWishlistBoardProps> = ({
  boardToken,
  listingsById,
  defaultVisitorName,
}) => {
  const [board, setBoard] = useState<SharedWishlistBoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitorName, setVisitorName] = useState(defaultVisitorName || "Guest");
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);

  const visitorId = getOrCreateVisitorId();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadBoard() {
      try {
        const res = await fetch(
          buildApiUrl(`/api/public/wishlists/${encodeURIComponent(boardToken)}`),
          { headers: getApiHeaders() }
        );
        if (res.ok) {
          const data = (await res.json()) as SharedWishlistBoardDto;
          if (!cancelled && data && Array.isArray(data.items)) {
            setBoard(data);
            setUsingLocalFallback(false);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to local tripWishlists store
      }

      // Fallback to local tripWishlists storage
      const local = getTripWishlistByToken(boardToken);
      if (!cancelled) {
        if (local) {
          setBoard({
            token: local.shareToken,
            title: local.title,
            items: local.items.map((item) => {
              const upvotes = Object.values(item.votes).filter((v) => v === "up").length;
              return {
                listingId: item.listingId,
                title: item.title,
                voteCount: upvotes,
                viewerVoted: item.votes[visitorId] === "up",
                notes: item.notes.map((n) => ({
                  id: n.id,
                  authorName: n.author,
                  text: n.text.slice(0, SHARED_WISHLIST_MAX_NOTE_LEN),
                  createdAtUtc: n.createdAt,
                })),
              };
            }),
          });
          setUsingLocalFallback(true);
        } else {
          setBoard(null);
        }
        setLoading(false);
      }
    }

    loadBoard();
    return () => {
      cancelled = true;
    };
  }, [boardToken, visitorId]);

  async function handleToggleVote(listingId: number) {
    if (!board) return;
    // Optimistic update (never touches personal favorites)
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) => {
          if (it.listingId !== listingId) return it;
          const nextVoted = !it.viewerVoted;
          return {
            ...it,
            viewerVoted: nextVoted,
            voteCount: Math.max(0, it.voteCount + (nextVoted ? 1 : -1)),
          };
        }),
      };
    });

    if (usingLocalFallback) {
      const local = getTripWishlistByToken(boardToken);
      if (local) {
        voteTripWishlistItem(local.id, listingId, visitorId, "up");
      }
      return;
    }

    try {
      const res = await fetch(
        buildApiUrl(`/api/public/wishlists/${encodeURIComponent(boardToken)}/votes`),
        {
          method: "POST",
          headers: { ...getApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            visitorId,
            visitorName: visitorName.trim() || "Guest",
          }),
        }
      );
      if (res.ok) {
        const updated = (await res.json().catch(() => null)) as
          | { voteCount?: number; viewerVoted?: boolean }
          | null;
        if (updated && typeof updated.voteCount === "number") {
          setBoard((prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((it) =>
                    it.listingId === listingId
                      ? {
                          ...it,
                          voteCount: updated.voteCount!,
                          viewerVoted: Boolean(updated.viewerVoted),
                        }
                      : it
                  ),
                }
              : prev
          );
        }
      }
    } catch {
      // Keep optimistic state
    }
  }

  async function handleAddNote(listingId: number, e: React.FormEvent) {
    e.preventDefault();
    const raw = (noteDrafts[listingId] || "").trim().slice(0, SHARED_WISHLIST_MAX_NOTE_LEN);
    if (!raw || !board) return;

    const author = visitorName.trim().slice(0, 40) || "Guest";
    const tempNote: SharedWishlistNoteDto = {
      id: `note_${Date.now().toString(36)}`,
      authorName: author,
      text: raw,
      createdAtUtc: new Date().toISOString(),
    };

    setBoard((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.listingId === listingId ? { ...it, notes: [...it.notes, tempNote] } : it
            ),
          }
        : prev
    );
    setNoteDrafts((prev) => ({ ...prev, [listingId]: "" }));
    setExpandedNotes((prev) => ({ ...prev, [listingId]: true }));

    if (usingLocalFallback) {
      const local = getTripWishlistByToken(boardToken);
      if (local) {
        addTripWishlistNote(local.id, listingId, author, raw);
      }
      return;
    }

    try {
      await fetch(
        buildApiUrl(`/api/public/wishlists/${encodeURIComponent(boardToken)}/notes`),
        {
          method: "POST",
          headers: { ...getApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            authorName: author,
            text: raw,
          }),
        }
      );
    } catch {
      // Keep optimistic note
    }
  }

  function handleCopyBoardLink() {
    const url = window.location.href;
    Promise.resolve()
      .then(() => navigator.clipboard?.writeText(url))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-border-subtle bg-bg-surface p-5 text-sm text-text-secondary"
        data-testid="shared-wishlist-loading"
      >
        Loading shared wishlist…
      </div>
    );
  }

  if (!board) {
    return (
      <div
        className="rounded-2xl border border-border-subtle bg-bg-surface p-5 text-sm text-text-secondary"
        data-testid="shared-wishlist-not-found"
      >
        This shared wishlist link could not be found or has expired.
      </div>
    );
  }

  return (
    <section
      className="rounded-2xl border border-brand-primary/30 bg-bg-surface p-4 sm:p-5 space-y-4 overflow-hidden"
      data-testid="shared-wishlist-board"
      aria-label="Collaborative shared wishlist"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-text-primary break-words">{board.title}</h2>
          <p className="text-xs text-text-secondary">
            Upvote your favourite stays and leave a short note (max {SHARED_WISHLIST_MAX_NOTE_LEN} chars) to decide together.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyBoardLink}
          data-testid="shared-wishlist-copy-link"
          className="min-h-11 rounded-lg border border-brand-primary px-3 py-1.5 text-sm font-medium text-brand-primary hover:bg-brand-primary/5"
        >
          {copied ? "✓ Board link copied!" : "Copy board link"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-text-secondary" htmlFor="shared-wishlist-visitor-name">
          Your name:
        </label>
        <input
          id="shared-wishlist-visitor-name"
          type="text"
          maxLength={40}
          value={visitorName}
          onChange={(e) => setVisitorName(e.target.value)}
          data-testid="shared-wishlist-visitor-input"
          className="rounded-md border border-border-subtle bg-bg-page px-2.5 py-1.5 text-sm text-text-primary w-44 max-w-full"
          placeholder="Your name"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {board.items.map((item) => {
          const meta = listingsById.get(item.listingId);
          const title = meta?.name || item.title || `Home #${item.listingId}`;
          const isExpanded = Boolean(expandedNotes[item.listingId]);
          const draft = noteDrafts[item.listingId] || "";

          return (
            <article
              key={item.listingId}
              className="rounded-xl border border-border-subtle bg-bg-page p-4 space-y-3 min-w-0"
              data-testid={`shared-wishlist-card-${item.listingId}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {meta?.href ? (
                    <Link
                      to={meta.href}
                      className="text-base font-semibold text-text-primary hover:text-brand-primary break-words"
                    >
                      {title}
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-text-primary break-words">{title}</h3>
                  )}
                  {meta?.priceLabel && (
                    <p className="text-xs text-text-secondary mt-0.5">{meta.priceLabel}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleVote(item.listingId)}
                  aria-pressed={item.viewerVoted}
                  data-testid={`wishlist-vote-btn-${item.listingId}`}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    item.viewerVoted
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-border-subtle bg-bg-surface text-text-primary hover:border-brand-primary"
                  }`}
                >
                  <span aria-hidden="true">{item.viewerVoted ? "♥" : "♡"}</span>
                  <span data-testid={`wishlist-vote-count-${item.listingId}`}>{item.voteCount}</span>
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotes((prev) => ({
                      ...prev,
                      [item.listingId]: !prev[item.listingId],
                    }))
                  }
                  data-testid={`wishlist-notes-toggle-${item.listingId}`}
                  className="text-xs font-medium text-brand-primary underline underline-offset-2"
                >
                  {isExpanded
                    ? `Hide notes (${item.notes.length})`
                    : `Notes (${item.notes.length})`}
                </button>

                {isExpanded && (
                  <div className="space-y-2" data-testid={`wishlist-notes-panel-${item.listingId}`}>
                    {item.notes.length === 0 ? (
                      <p className="text-xs text-text-muted">No notes yet. Add a quick thought below.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {item.notes.map((n) => (
                          <li
                            key={n.id}
                            className="rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs text-text-primary break-words"
                          >
                            <span className="font-semibold">{n.authorName}:</span> {n.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <form
                      onSubmit={(e) => handleAddNote(item.listingId, e)}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        type="text"
                        maxLength={SHARED_WISHLIST_MAX_NOTE_LEN}
                        value={draft}
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({
                            ...prev,
                            [item.listingId]: e.target.value.slice(0, SHARED_WISHLIST_MAX_NOTE_LEN),
                          }))
                        }
                        placeholder="Add a short note (max 200 chars)…"
                        data-testid={`wishlist-note-input-${item.listingId}`}
                        className="flex-1 min-w-0 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-2 text-sm text-text-primary"
                      />
                      <button
                        type="submit"
                        disabled={!draft.trim()}
                        data-testid={`wishlist-note-submit-${item.listingId}`}
                        className="min-h-11 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Post note
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default SharedWishlistBoard;
