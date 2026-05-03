/**
 * TASK-1459: Horizontal strip of recently viewed listings (localStorage).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentlyViewed, removeRecentlyViewed, type GuestListingHistoryItem } from "../utils/guestHistory";
import OptimizedImage from "./ui/OptimizedImage";

const DISPLAY_CAP = 8;

function readItems(): GuestListingHistoryItem[] {
  return getRecentlyViewed().slice(0, DISPLAY_CAP);
}

export default function RecentlyViewedStrip() {
  const [items, setItems] = useState(readItems);

  useEffect(() => {
    const refresh = () => setItems(readItems());
    window.addEventListener("storage", refresh);
    window.addEventListener("atlas-recently-viewed-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("atlas-recently-viewed-changed", refresh);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-border-subtle bg-bg-surface px-3 py-4 shadow-sm"
      data-testid="recently-viewed-strip"
      aria-label="Recently viewed"
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Recently viewed</h2>
        <Link to="/recent" className="text-xs font-medium text-cta-primary hover:underline">
          See all
        </Link>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory sm:grid sm:grid-cols-4 sm:overflow-visible"
        role="list"
      >
        {items.map((it) => (
          <div
            key={`${it.listingId}-${it.viewedAtUtc}`}
            role="listitem"
            className="relative w-[140px] shrink-0 snap-start sm:w-auto"
          >
            <Link
              to={it.path}
              className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-muted transition hover:border-cta-primary"
            >
              <div className="aspect-[4/3] w-full bg-bg-muted">
                {it.coverPhotoUrl ? (
                  <OptimizedImage
                    src={it.coverPhotoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="140px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">No photo</div>
                )}
              </div>
              <div className="line-clamp-2 p-2 text-xs font-medium text-text-primary">{it.name ?? `Listing ${it.listingId}`}</div>
            </Link>
            <button
              type="button"
              onClick={() => removeRecentlyViewed(it.listingId)}
              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white text-xs leading-none hover:bg-black/60"
              aria-label={`Remove ${it.name ?? 'this listing'} from recently viewed`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
