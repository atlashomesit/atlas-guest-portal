/**
 * TASK-1716: Review summary + sentiment chip.
 *
 * Fetches the keyword-bucketed summary from GET /api/listings/{id}/reviews/summary
 * and renders a sentiment chip + top 3 keywords.
 *
 * Returns null when the listing has fewer than 3 reviews (API returns 204).
 * Behind Reviews:UseLlmSummary=false flag on the API for future LLM upgrade.
 */
import React, { useEffect, useState } from "react";
import { buildApiUrl, getApiHeaders } from "@/api/client";

interface ReviewSummaryData {
  listingId: number;
  reviewCount: number;
  sentiment: "positive" | "mixed" | "negative";
  positivePercent: number;
  topKeywords: string[];
}

interface ReviewSummaryProps {
  listingId: number;
}

const SENTIMENT_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  positive: { bg: "bg-emerald-50", text: "text-emerald-700", emoji: "😊" },
  mixed:    { bg: "bg-amber-50",   text: "text-amber-700",   emoji: "😐" },
  negative: { bg: "bg-red-50",     text: "text-red-700",     emoji: "😕" },
};

export default function ReviewSummary({ listingId }: ReviewSummaryProps) {
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
