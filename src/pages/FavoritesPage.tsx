import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import SEO from "../components/SEO";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { getFavoriteIds, getRecentlyViewed, toggleFavorite } from "../utils/guestHistory";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { getTenantBrandName } from "../tenant/displayBrand";
import { LoadingState } from "../components/LoadingState";
import { useCurrency } from "../contexts/CurrencyContext";
import { useDailyPricingSummary } from "../hooks/useDailyPricingSummary";
import { estimateStayNights, formatEstTotalInclGst } from "../utils/guestPriceEstimate";
import SavedHomeCover from "../components/SavedHomeCover";
import SavedHomesReminder from "../components/SavedHomesReminder";
import { useGuestAuth } from "../contexts/GuestAuthContext";

export default function FavoritesPage() {
  const brandName = getTenantBrandName();
  const { format: formatDisplayCurrency, formatINR, isConverted } = useCurrency();
  const { getListingPricing: getDailyListingPricing } = useDailyPricingSummary();
  const estimateNights = estimateStayNights(null, null);
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

  const { auth, isLoading: authLoading } = useGuestAuth();
  const knownEmail = auth.isAuthenticated ? (auth.email?.trim() ?? "") : "";
  const reminderTenant = getApiHeaders()["X-Tenant-Slug"];
  // Reset typed addresses, progress and success immediately at an account/tenant boundary.
  const reminderScope = JSON.stringify([reminderTenant, auth.isAuthenticated, auth.guestId, knownEmail.toLowerCase()]);

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
        {!authLoading && !sharedWishlistIds && (
          <SavedHomesReminder
            key={reminderScope}
            initialEmail={knownEmail}
            tenantSlug={reminderTenant}
            listingIds={favorites.map((listing) => listing.id)}
          />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((l) => {
            const path = listingPath(l);
            const dailyBreakdown = getDailyListingPricing(l.id);
            const displayedPrice =
              (dailyBreakdown?.actualPrice ?? 0) > 0
                ? dailyBreakdown!.actualPrice
                : (l.baseNightlyRate ?? 0);
            // TASK-7543: GST slab is selected off the CHARGED (discounted) rate, matching the
            // server — see accommodationGstSlabPercentForChargedRate's doc comment.
            // `displayedPrice` is already that charged value, so the default (no override)
            // banding basis below is correct.
            return (
              <div
                key={l.id}
                className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow"
              >
                <div className="relative">
                  <Link to={path} className="block">
                    <SavedHomeCover src={l.coverPhotoUrl} alt={l.name ?? "Home"} />
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
                  {displayedPrice > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-sm text-text-primary">
                        <span className="font-semibold">{formatDisplayCurrency(displayedPrice)}</span>
                        <span className="text-text-secondary"> / night</span>
                      </p>
                      {isConverted && (
                        <p className="text-xs text-text-muted">{formatINR(displayedPrice)} on payment</p>
                      )}
                      <p className="text-xs text-text-muted">
                        {formatEstTotalInclGst(
                          displayedPrice,
                          estimateNights,
                          formatDisplayCurrency,
                          3,
                          l.isGstRegistered,
                        )}
                      </p>
                    </div>
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
