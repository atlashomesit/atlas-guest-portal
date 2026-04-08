import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { fetchPublicListings, type PublicListing } from "../api/listingClient";
import { getFavoriteIds, getRecentlyViewed } from "../utils/guestHistory";

export default function FavoritesPage() {
  const [all, setAll] = useState<PublicListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadListings = React.useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicListings()
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch(() => {
        if (!cancelled) {
          setAll([]);
          setError("We couldn’t load saved homes right now. Please try again.");
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

  const favIds = useMemo(() => new Set(getFavoriteIds()), []);
  const recent = useMemo(() => getRecentlyViewed(), []);

  const favorites = useMemo(() => all.filter((l) => favIds.has(l.id)), [all, favIds]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <SEO title="Saved homes | Atlas Homestays" description="Your saved Atlas Homestays listings." />
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-text-primary">Saved homes</h1>
        <Link to="/" className="text-sm text-brand-primary underline underline-offset-2">
          Back to home
        </Link>
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
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
          <p className="text-text-secondary">No saved homes yet. Tap “Save” on a listing.</p>
          {recent.length > 0 && (
            <p className="text-xs text-text-muted mt-2">
              Tip: you can also revisit recent homes via the “Recently viewed” section on listing pages.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((l) => (
            <Link
              key={l.id}
              to={`/homes/${String(l.propertyName ?? "home").toLowerCase().replace(/\\s+/g, "-")}/${l.id}`}
              className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow"
            >
              {l.coverPhotoUrl ? (
                <img src={l.coverPhotoUrl} alt={l.name ?? "Home"} className="w-full h-40 object-cover" loading="lazy" />
              ) : null}
              <div className="p-4">
                <p className="font-semibold text-text-primary">{l.name ?? l.propertyName ?? `Listing ${l.id}`}</p>
                <p className="text-sm text-text-secondary">{l.propertyAddress ?? ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

