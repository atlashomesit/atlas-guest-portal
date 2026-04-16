import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getRecentlyViewed } from "../utils/guestHistory";

export default function RecentlyViewedPage() {
  const items = useMemo(() => getRecentlyViewed(), []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <SEO title="Recently viewed | Atlas Homestays" description="Homes you viewed recently on Atlas Homestays." />
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-text-primary">Recently viewed</h1>
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
          {items.map((it) => (
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
          ))}
        </div>
      )}
    </div>
  );
}

