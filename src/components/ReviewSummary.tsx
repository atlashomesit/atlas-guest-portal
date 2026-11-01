/**
 * TASK-1716: Review summary + sentiment chip.
 *
 * Fetches the keyword-bucketed summary from GET /api/listings/{id}/reviews/summary
 * and renders a sentiment chip + top 3 keywords.
 *
 * Returns null when the listing has fewer than 3 reviews (API returns 204).
 * Behind Reviews:UseLlmSummary=false flag on the API for future LLM upgrade.
 *
 * TASK-10089 / REV-015: marketplace provenance gating. The summary is computed from
 * visible native reviews (>= 4★) and active external reviews (!IsHidden, Rating >= 4).
 * When the hosting card passes its own `verifiedStayCount` (from GET /marketplace/listings),
 * the chip renders only if the summary's verified-stay count agrees. A mismatch means the card
 * and the chip describe different verified review sets — rendering either label would be
 * unverified proof — so the chip hides. Surfaces that pass no expectation keep the historical behaviour.
 *
 * TASK-1039954: a card grid mounts one ReviewSummary per card, which used to be 14-20 summary requests at the
 * moment the grid rendered (and 20+ net::ERR_ABORTED when the guest left). `lazy` makes a card ask only once it is
 * near the viewport. Without `lazy`, or where IntersectionObserver does not exist, it fetches at mount as before.
 */
import { useEffect, useRef, useState } from "react";
import { buildApiUrl, getApiHeaders } from "@/api/client";

interface ReviewSummaryData {
  listingId: number;
  reviewCount: number;
  sentiment: "positive" | "mixed" | "negative";
  positivePercent: number;
  topKeywords: string[];
  /** TASK-10089: native completed-stay reviews verified by Atlas. Absent on older API builds. */
  verifiedStayCount?: number;
  /** TASK-10089: imported external reviews (Google etc.). Absent on older API builds. */
  externalReviewCount?: number;
}

interface ReviewSummaryProps {
  listingId: number;
  /**
   * TASK-10089: the card's own verified-stay count. When provided AND the summary
   * carries its own count, the two must agree or the chip hides. When either side
   * is absent (older API, non-marketplace surface) the chip renders as before.
   */
  verifiedStayCount?: number | null;
  /** TASK-1039954: defer the request until the card is near the viewport (card grids). Default: fetch at mount. */
  lazy?: boolean;
}

const SENTIMENT_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  positive: { bg: "bg-emerald-50", text: "text-emerald-700", emoji: "😊" },
  mixed:    { bg: "bg-amber-50",   text: "text-amber-700",   emoji: "😐" },
  negative: { bg: "bg-red-50",     text: "text-red-700",     emoji: "😕" },
};

const reviewSummaryCache = new Map<number, { promise: Promise<ReviewSummaryData | null>; expiresAt: number }>();

export function _clearReviewSummaryCacheForTests(): void {
  reviewSummaryCache.clear();
}

function fetchReviewSummary(listingId: number): Promise<ReviewSummaryData | null> {
  const now = Date.now();
  const cached = reviewSummaryCache.get(listingId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetch(buildApiUrl(`/api/listings/${listingId}/reviews/summary`), {
    headers: getApiHeaders(),
  })
    .then((res) => {
      if (res.status === 204 || !res.ok) return null;
      return res.json() as Promise<ReviewSummaryData>;
    })
    .catch(() => null);

  reviewSummaryCache.set(listingId, { promise, expiresAt: now + 5 * 60 * 1000 });
  return promise;
}

/** How close to the viewport (px) a lazy card must be before it asks, so the chip is usually there as it scrolls in. */
const LAZY_ROOT_MARGIN = "300px 0px";

export default function ReviewSummary({ listingId, verifiedStayCount, lazy = false }: ReviewSummaryProps) {
  const [data, setData] = useState<ReviewSummaryData | null>(null);
  // Fetch at mount unless the card asked to be lazy AND the browser can tell us when it is near the viewport.
  const [shouldFetch, setShouldFetch] = useState<boolean>(() => !lazy || typeof IntersectionObserver === "undefined");
  const sentinelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (shouldFetch) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShouldFetch(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldFetch(true);
          observer.disconnect();
        }
      },
      { rootMargin: LAZY_ROOT_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldFetch]);

  useEffect(() => {
    if (!listingId || !shouldFetch) return;
    let active = true;

    void fetchReviewSummary(listingId).then((json) => {
      if (active) setData(json);
    });

    return () => {
      active = false;
    };
  }, [listingId, shouldFetch]);

  // Out of the layout flow (absolute) so a not-yet-asked card gets no extra gap from its flex parent.
  if (!shouldFetch) {
    return (
      <span
        ref={sentinelRef}
        aria-hidden="true"
        data-testid="review-summary-sentinel"
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />
    );
  }

  if (!data || !Array.isArray(data.topKeywords) || data.topKeywords.length === 0) return null;

  // TASK-10089: source/count agreement with the hosting card. Gate only when both
  // sides carry the number — an older API without the field must not blank chips.
  if (
    verifiedStayCount !== undefined &&
    verifiedStayCount !== null &&
    data.verifiedStayCount !== undefined &&
    data.verifiedStayCount !== verifiedStayCount
  ) {
    return null;
  }

  const style = SENTIMENT_STYLES[data.sentiment] ?? SENTIMENT_STYLES.mixed;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
        title={`${data.positivePercent}% positive reviews (${data.reviewCount} checked)`}
      >
        {style.emoji} {data.sentiment === "positive" ? "Mostly positive" : data.sentiment === "negative" ? "Mixed reviews" : "Mixed"}
      </span>
      <span className="text-[11px] text-text-muted">
        Guests mention: <span className="font-medium text-text-secondary">{data.topKeywords.join(", ")}</span>
      </span>
    </div>
  );
}
