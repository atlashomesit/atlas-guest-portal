/**
 * TASK-1716: Review summary + sentiment chip.
 *
 * Fetches the keyword-bucketed summary from GET /api/listings/{id}/reviews/summary
 * and renders a sentiment chip + top 3 keywords.
 *
 * Returns null when the listing has fewer than 3 reviews (API returns 204).
 * Behind Reviews:UseLlmSummary=false flag on the API for future LLM upgrade.
 *
 * TASK-10089: marketplace provenance gating. The summary is computed from native
 * Atlas reviews only, so when the hosting card passes its own `verifiedStayCount`
 * (from GET /marketplace/listings) the chip renders only if the summary's
 * verified-stay count agrees. A mismatch means the card and the chip describe
 * different review sets — rendering either label would be unverified proof — so
 * the chip hides. Surfaces that pass no expectation keep the historical behaviour.
 */
import { useEffect, useState } from "react";
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
}

const SENTIMENT_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  positive: { bg: "bg-emerald-50", text: "text-emerald-700", emoji: "😊" },
  mixed:    { bg: "bg-amber-50",   text: "text-amber-700",   emoji: "😐" },
  negative: { bg: "bg-red-50",     text: "text-red-700",     emoji: "😕" },
};

export default function ReviewSummary({ listingId, verifiedStayCount }: ReviewSummaryProps) {
  const [data, setData] = useState<ReviewSummaryData | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let active = true;

    fetch(buildApiUrl(`/api/listings/${listingId}/reviews/summary`), {
      headers: getApiHeaders(),
    })
      .then((res) => {
        if (!active) return;
        if (res.status === 204) {
          setData(null);
          return;
        }
        if (!res.ok) return;
        return res.json();
      })
      .then((json) => {
        if (active && json) setData(json as ReviewSummaryData);
      })
      .catch(() => {
        // Non-critical — silently skip if API unavailable or listing has no reviews.
      });

    return () => {
      active = false;
    };
  }, [listingId]);

  if (!data || data.topKeywords.length === 0) return null;

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
