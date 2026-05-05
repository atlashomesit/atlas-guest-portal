/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { fetchPublicListings } from "../api/listingClient";
import { clearRecentlyViewed, getRecentlyViewed } from "../utils/guestHistory";
import { formatCurrency } from "../utils/formatting";
import { getTenantContext } from "../tenant/tenantContext";

export default function RecentlyViewedPage() {
  const brandName = getTenantContext()?.name ?? 'Atlas Homestays';
  const [items, setItems] = useState(() => getRecentlyViewed());
  const [liveNightlyByListingId, setLiveNightlyByListingId] = useState<Record<number, number>>({});

  useEffect(() => {
    if (items.length === 0) {
      setLiveNightlyByListingId({});
      return;
    }
    const ac = new AbortController();
    fetchPublicListings(ac.signal)
      .then((list) => {
        const next: Record<number, number> = {};
        for (const row of list) {
          const rate = row.baseNightlyRate;
          if (rate != null && Number.isFinite(rate) && rate > 0) {
            next[row.id] = rate;
          }
        }
        setLiveNightlyByListingId(next);
      })
      .catch(() => {
        /* keep cards; chips hidden without live prices */
      });
    return () => ac.abort();
  }, [items]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <SEO title={`Recently viewed | ${brandName}`} description={`Homes you viewed recently on ${brandName}.`} />
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-text-primary">Recently viewed</h1>
          {items.length > 0 ? (
            <button
              type="button"
              data-testid="recently-viewed-clear-history"
              className="text-sm text-text-muted hover:text-text-primary underline underline-offset-2"
              onClick={() => {
                clearRecentlyViewed();
                setItems([]);
                setLiveNightlyByListingId({});
              }}
            >
              Clear history
            </button>
          ) : null}
        </div>
        <Link to="/" className="text-sm text-brand-primary underline underline-offset-2">
          Back to home
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6">
          <p className="text-text-secondary">No recent homes yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => {
            const stored = it.pricePerNight;
            const current = liveNightlyByListingId[it.listingId];
            const hasCompare =
              stored != null &&
              stored > 0 &&
              current != null &&
              current > 0 &&
              Number.isFinite(stored) &&
              Number.isFinite(current);
            const delta = hasCompare ? current - stored : null;

            return (
              <div
                key={`${it.listingId}-${it.viewedAtUtc}`}
                className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow"
              >
                <Link to={it.path}>
                  {it.coverPhotoUrl ? (
                    <img src={it.coverPhotoUrl} alt={it.name ?? "Home"} className="w-full h-40 object-cover" loading="lazy" />
                  ) : null}
                  <div className="p-4 pb-2">
                    <p className="font-semibold text-text-primary">{it.name ?? `Listing ${it.listingId}`}</p>
                    <p className="text-sm text-text-secondary">{it.location ?? ""}</p>
                    {stored != null && stored > 0 ? (
                      <p className="text-sm text-text-primary mt-1">
                        <span className="font-semibold">₹{stored.toLocaleString("en-IN")}</span>
                        <span className="text-text-secondary"> / night</span>
                      </p>
                    ) : null}
                    {delta != null && delta !== 0 ? (
                      <p
                        className={`text-xs font-semibold mt-1.5 ${delta < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                        data-testid={`recently-viewed-price-delta-${it.listingId}`}
                      >
                        {delta < 0
                          ? `↓ Price dropped ${formatCurrency(Math.round(Math.abs(delta)), { maximumFractionDigits: 0 })}`
                          : `↑ Price went up ${formatCurrency(Math.round(delta), { maximumFractionDigits: 0 })}`}
                      </p>
                    ) : null}
                    <p className="text-xs text-text-muted mt-1">
                      Viewed {new Date(it.viewedAtUtc).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </Link>
                <div className="px-4 pb-4">
                  <Link
                    to={it.path}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2 hover:opacity-95 transition-opacity"
                  >
                    Book now
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
