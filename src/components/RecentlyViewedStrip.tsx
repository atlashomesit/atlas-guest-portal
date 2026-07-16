/**
 * TASK-1459: Horizontal strip of recently viewed listings (localStorage).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentlyViewed, removeRecentlyViewed, type GuestListingHistoryItem } from "../utils/guestHistory";
import { sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { getPropertyDesignImage } from "../config/branding";
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
      className="rounded-2xl border border-border-subtle bg-bg-surface px-4 py-4 shadow-sm"
      data-testid="recently-viewed-strip"
      aria-label="Recently viewed"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Recently viewed</h2>
        <Link to="/recent" className="text-xs font-medium text-cta-primary hover:underline">
          See all
        </Link>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x snap-mandatory"
        role="list"
      >
        {items.map((it) => {
          // Only render a real <img> for sanitized canonical URLs (TASK-4289).
          // Blocked/empty covers get a CSS design wash — never a broken img src.
          const cover = sanitizeGuestImageUrl(it.coverPhotoUrl);
          const designWash = getPropertyDesignImage(it.listingId);
          return (
          <div
            key={`${it.listingId}-${it.viewedAtUtc}`}
            role="listitem"
            className="relative w-[152px] shrink-0 snap-start"
          >
            <Link
              to={it.path}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-muted transition hover:border-cta-primary"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-bg-muted">
                {cover ? (
                  <OptimizedImage
                    src={cover}
                    alt={it.name ?? `Listing ${it.listingId}`}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="160px"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{
                      backgroundImage: `url("${designWash}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <div className="line-clamp-2 p-2 pb-0 text-xs font-medium text-text-primary">
                {it.name ?? `Listing ${it.listingId}`}
              </div>
              <div className="mt-auto px-2 pb-2 pt-1">
                <span className="block text-[10px] text-text-muted leading-tight">Still available? Book now →</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => removeRecentlyViewed(it.listingId)}
              className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white text-xs leading-none hover:bg-black/60"
              aria-label={`Remove ${it.name ?? "this listing"} from recently viewed`}
            >
              ×
            </button>
          </div>
          );
        })}
      </div>
    </section>
  );
}
