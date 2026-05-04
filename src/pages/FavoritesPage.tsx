/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import SEO from "../components/SEO";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { getFavoriteIds, getRecentlyViewed, toggleFavorite } from "../utils/guestHistory";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { buildApiUrl, getApiHeaders } from "../api/client";

export default function FavoritesPage() {
  const [all, setAll] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favEpoch, setFavEpoch] = useState(0);
  // TASK-1299: Wishlist share — copy link to clipboard
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [searchParams] = useSearchParams();
  const sharedWishlistIds = useMemo(() => {
    const token = searchParams.get("wishlist");
    if (!token) return null;
    try { return atob(token).split(",").map(Number).filter(Boolean); } catch { return null; }
  }, [searchParams]);

  // TASK-1709: reminder email capture
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderState, setReminderState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [hasStoredEmail, setHasStoredEmail] = useState(() => {
    try { return !!localStorage.getItem("atlas_guest_email"); } catch { return false; }
  });
  const reminderInputRef = useRef<HTMLInputElement>(null);

  const loadListings = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicListings()
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAll([]);
          const message =
            err instanceof Error && err.message
              ? err.message
              : "We couldn't load saved homes right now. Please try again.";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadListings(), [loadListings]);

  const favIds = useMemo(() => new Set(getFavoriteIds()), [favEpoch]);
  const recent = useMemo(() => getRecentlyViewed(), []);

  const favorites = useMemo(() => {
    if (sharedWishlistIds) return all.filter((l) => sharedWishlistIds.includes(l.id));
    return all.filter((l) => favIds.has(l.id));
  }, [all, favIds, sharedWishlistIds]);

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = reminderEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setReminderState("busy");
    try {
      const ids = getFavoriteIds();
      await Promise.all(
        ids.map((listingId) =>
          fetch(buildApiUrl("/api/saved-listings"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getApiHeaders() },
            body: JSON.stringify({ guestEmail: email, listingId }),
          })
        )
      );
      localStorage.setItem("atlas_guest_email", email);
      setHasStoredEmail(true);
      setReminderState("done");
    } catch {
      setReminderState("error");
    }
  };

  const listingPath = (l: PublicListing) =>
    buildHomeUnitPath(getPropertySlug({ name: l.name, property_name: l.propertyName }), l.id);

  // TASK-1299: encode saved IDs into shareable URL (no backend needed)
  const handleShareWishlist = () => {
    const ids = getFavoriteIds();
    if (!ids.length) return;
    const token = btoa(ids.join(","));
    const shareUrl = `${window.location.origin}/favorites?wishlist=${encodeURIComponent(token)}`;
    const waText = `Check out these Atlas Homestays I saved! ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    if (navigator.share) {
      navigator.share({ title: "My Atlas Homestays Wishlist", url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2500);
      }).catch(() => {
        window.open(whatsappUrl, "_blank", "noopener");
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <SEO title="Saved homes | Atlas Homestays" description="Your saved Atlas Homestays listings." />
      {/* TASK-1299: Shared wishlist banner */}
      {sharedWishlistIds && (
        <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-text-primary">
          👥 Someone shared their wishlist with you — {sharedWishlistIds.length} saved home{sharedWishlistIds.length !== 1 ? "s" : ""}.
          <Link to="/favorites" className="ml-2 text-brand-primary underline underline-offset-2">View your own wishlist</Link>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-text-primary">Saved homes</h1>
        <div className="flex items-center gap-3">
          {/* TASK-1299: Share wishlist via WhatsApp / native share / clipboard */}
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={handleShareWishlist}
              className="text-sm font-medium text-brand-primary border border-brand-primary rounded-lg px-3 py-1.5 hover:bg-brand-primary/5 transition-colors"
            >
              {shareState === "copied" ? "✓ Link copied!" : "Share wishlist"}
            </button>
          )}
          <Link to="/" className="text-sm text-brand-primary underline underline-offset-2">
            Back to home
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : error ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-3">
          <p className="text-text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => loadListings()}
            className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2.5 hover:opacity-95 transition-opacity"
          >
            Retry
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-4">
          <p className="text-text-secondary">No saved homes yet. Tap “Save” on a listing.</p>
          <Link
            to="/search"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary text-white text-base font-medium px-5 py-3 hover:opacity-95 transition-opacity"
          >
            Browse Atlas Homestays
          </Link>
          {recent.length > 0 && (
            <p className="text-xs text-text-muted">
              Tip: you can also revisit recent homes via the “Recently viewed” section on listing pages.
            </p>
          )}
        </div>
      ) : (
        <>
        {/* TASK-1709: email capture for saved-listing T+7 reminders */}
        {!hasStoredEmail && favorites.length > 0 && reminderState !== "done" && (
          <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-4">
            <p className="text-sm font-medium text-text-primary mb-1">Get reminded about these homes</p>
            <p className="text-xs text-text-secondary mb-3">
              Enter your email and we'll send you a one-time reminder in 7 days if you haven't booked yet.
            </p>
            <form onSubmit={handleReminderSubmit} className="flex gap-2 flex-wrap">
              <input
                ref={reminderInputRef}
                type="email"
                required
                placeholder="your@email.com"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button
                type="submit"
                disabled={reminderState === "busy"}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {reminderState === "busy" ? "Saving…" : "Remind me"}
              </button>
            </form>
            {reminderState === "error" && (
              <p className="text-xs text-red-600 mt-2">Couldn't save your email. Please try again.</p>
            )}
          </div>
        )}
        {reminderState === "done" && (
          <p className="text-sm text-green-700 font-medium">✓ We'll remind you in 7 days if you haven't booked.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((l) => {
            const path = listingPath(l);
            return (
              <div
                key={l.id}
                className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow"
              >
                <div className="relative">
                  <Link to={path} className="block">
                    {l.coverPhotoUrl ? (
                      <img src={l.coverPhotoUrl} alt={l.name ?? "Home"} className="w-full h-40 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-40 bg-bg-muted" aria-hidden />
                    )}
                  </Link>
                  <button
                    type="button"
                    data-testid={`favorites-remove-${l.id}`}
                    className="absolute top-2 right-2 z-10 rounded-full bg-bg-surface/95 p-2 shadow-level1 border border-border-subtle hover:opacity-95 transition-opacity"
                    aria-label="Remove from saved"
                    onClick={() => {
                      toggleFavorite(l.id);
                      setFavEpoch((e) => e + 1);
                    }}
                  >
                    <FaHeart className="h-5 w-5 text-red-500" aria-hidden />
                  </button>
                </div>
                <Link to={path} className="block p-4 pb-2">
                  <p className="font-semibold text-text-primary">{l.name ?? l.propertyName ?? `Listing ${l.id}`}</p>
                  <p className="text-sm text-text-secondary">{l.propertyAddress ?? ""}</p>
                  {l.baseNightlyRate != null && l.baseNightlyRate > 0 ? (
                    <p className="text-sm text-text-primary mt-1">
                      <span className="font-semibold">₹{l.baseNightlyRate.toLocaleString("en-IN")}</span>
                      <span className="text-text-secondary"> / night</span>
                    </p>
                  ) : null}
                </Link>
                <div className="px-4 pb-4">
                  <Link
                    to={path}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3 hover:opacity-95 transition-opacity"
                  >
                    Book now
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
