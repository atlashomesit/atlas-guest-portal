import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import SEO from "../components/SEO";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { getFavoriteIds, getRecentlyViewed, toggleFavorite } from "../utils/guestHistory";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { getTenantBrandName } from "../tenant/displayBrand";
import { LoadingState } from "../components/LoadingState";

export default function FavoritesPage() {
  const brandName = getTenantBrandName();
  const [all, setAll] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favEpoch, setFavEpoch] = useState(0);
  // TASK-1299: Wishlist share — copy link to clipboard
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [searchParams] = useSearchParams();
  // TASK-4010: Server-side sync status indicator
  const [syncStatus, setSyncStatus] = useState<"idle" | "synced" | "local">("idle");
  const sharedWishlistIds = useMemo(() => {
    const token = searchParams.get("wishlist");
    if (!token) return null;
    try { return atob(token).split(",").map(Number).filter(Boolean); } catch { return null; }
  }, [searchParams]);

  // TASK-1709: reminder email capture
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderState, setReminderState] = useState<"idle" | "busy" | "done" | "error" | "invalid">("idle");
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
        if (!cancelled) {
          setAll(list);
          // TASK-4010: Check if API is available by attempting a non-critical fetch
          checkApiAvailability();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAll([]);
          console.error("Favorites listings load failed:", err);
          setError("We couldn't load saved homes right now. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // TASK-4010: Check if SavedListingsController API is available (TASK-4526: only count as synced if GET works)
  const checkApiAvailability = React.useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/saved-listings"), {
        method: "GET",
        headers: getApiHeaders(),
      });
      // Only mark as synced if GET succeeds (200/partial content); favorites are server-synced
      if (res.ok) {
        setSyncStatus("synced");
      } else {
        setSyncStatus("local");
      }
    } catch {
      // Network error or endpoint truly unavailable — fall back to localStorage
      setSyncStatus("local");
    }
  }, []);

  useEffect(() => loadListings(), [loadListings]);

  const favIds = useMemo(() => {
    void favEpoch;
    return new Set(getFavoriteIds());
  }, [favEpoch]);
  const recent = useMemo(() => getRecentlyViewed(), []);

  const favorites = useMemo(() => {
    if (sharedWishlistIds) return all.filter((l) => sharedWishlistIds.includes(l.id));
    return all.filter((l) => favIds.has(l.id));
  }, [all, favIds, sharedWishlistIds]);

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = reminderEmail.trim().toLowerCase();
    // TASK-4968: this regex is stricter than the browser's native `type="email"` check
    // (e.g. it rejects `me@localhost`), so a rejection here must surface feedback via
    // the existing error-state UI instead of silently no-opping.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setReminderState("invalid");
      return;
    }
    setReminderState("busy");
    try {
      const ids = getFavoriteIds();
      const results = await Promise.allSettled(
        ids.map((listingId) =>
          fetch(buildApiUrl("/api/saved-listings"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getApiHeaders() },
            body: JSON.stringify({ guestEmail: email, listingId }),
          })
        )
      );
      // TASK-4526: Count successes and failures separately; only proceed if ALL succeeded
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.ok
      ).length;
      const failed = ids.length - successful;

      if (successful === 0) {
        setReminderState("error");
        return;
      }

      // If any failed, show a partial-failure message via error state
      if (failed > 0) {
        // Store the email anyway (guest will get reminders for the successful ones)
        localStorage.setItem("atlas_guest_email", email);
        setHasStoredEmail(true);
        // Show error state but include success count context
        alert(`Reminder set for ${successful} of ${ids.length} homes. Please check your email.`);
        setReminderState("done");
        return;
      }

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
    const waText = `Check out these ${brandName} I saved! ${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    if (navigator.share) {
      navigator.share({ title: `My ${brandName} Wishlist`, url: shareUrl }).catch(() => {});
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
      <SEO title={`Saved homes | ${brandName}`} description={`Your saved ${brandName} listings.`} />
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
          {/* TASK-4010: Sync status indicator */}
          {syncStatus === "synced" && (
            <span className="text-xs text-green-700 font-medium">✓ Synced</span>
          )}
          {syncStatus === "local" && (
            <span className="text-xs text-text-muted font-medium">Local only</span>
          )}
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
          <Link
            to="/communication-preferences"
            className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
            data-testid="favorites-manage-preferences-hint"
          >
            Manage preferences
          </Link>
          <Link to="/" className="text-sm text-brand-primary underline underline-offset-2">
            Back to home
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState kind="skeleton-grid" count={6} message="Loading saved homes…" />
      ) : error ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-3">
          <p className="text-text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => loadListings()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-brand-primary text-white text-base font-medium px-5 py-3 hover:opacity-95 transition-opacity"
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
            Browse {brandName}
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
                className="flex-1 min-w-0 rounded-lg border border-border-subtle px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button
                type="submit"
                disabled={reminderState === "busy"}
                className="rounded-lg bg-brand-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50 min-h-11"
              >
                {reminderState === "busy" ? "Saving…" : "Remind me"}
              </button>
            </form>
            {reminderState === "error" && (
              <p className="text-xs text-red-600 mt-2" role="alert">
                We couldn&apos;t save your reminder for every saved home. Please try again in a moment.
              </p>
            )}
            {reminderState === "invalid" && (
              <p className="text-xs text-red-600 mt-2" role="alert">
                Please enter a valid email address.
              </p>
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
                  {/* TASK-4297: in a SHARED wishlist view the listing isn't the viewer's own save —
                      the remove heart would silently mutate the viewer's own favorites and never
                      update this (shared-IDs-driven) card. Only show it on the viewer's own list. */}
                  {!sharedWishlistIds && (
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
                  )}
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
                <div className="px-4 pb-4 space-y-2">
                  {/* TASK-2578: re-engagement nudge for saved-but-not-booked listings */}
                  <p className="text-xs text-text-secondary">
                    You saved this — still available for your dates?
                  </p>
                  <Link
                    to={path}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3 hover:opacity-95 transition-opacity"
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
