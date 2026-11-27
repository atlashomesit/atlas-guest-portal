import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "@/runtime-config";

export interface PublicEmbedReviewItem {
  id: number | string;
  rating: number;
  comment?: string | null;
  reviewerName?: string | null;
  source?: string | null;
  createdAt?: string | null;
  isHidden?: boolean;
}

export function filterQualifyingReviews(rows: PublicEmbedReviewItem[]): PublicEmbedReviewItem[] {
  return rows.filter((r) => typeof r.rating === "number" && r.rating >= 4 && !r.isHidden);
}

export function formatFirstName(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "A guest";
  return trimmed.split(/\s+/)[0] || "A guest";
}

export default function ReviewsWidgetEmbedPage(): React.ReactElement | null {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [searchParams] = useSearchParams();
  const layout = (searchParams.get("layout") ?? "carousel").toLowerCase();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [reviews, setReviews] = useState<PublicEmbedReviewItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!embedKey) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/public/embed/${encodeURIComponent(embedKey)}/reviews`);
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const raw = await res.json();
        const items: PublicEmbedReviewItem[] = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
        if (!cancelled) {
          setReviews(filterQualifyingReviews(items));
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [embedKey]);

  useEffect(() => {
    if (!loaded || typeof window === "undefined" || window.parent === window) return;
    const height = rootRef.current?.scrollHeight ?? 0;
    window.parent.postMessage({ type: "atlas-embed-resize", height }, "*");
  }, [loaded, reviews, layout]);

  if (!loaded || reviews.length === 0) return null;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const avgText = avg.toFixed(1);

  if (layout === "badge") {
    return (
      <div
        ref={rootRef}
        data-testid="rev058-embed-badge"
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span>{`${avgText} ★`}</span>
        <span style={{ color: "#475569", fontWeight: 500 }}>
          {`from ${reviews.length} verified ${reviews.length === 1 ? "guest" : "guests"}`}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="rev058-embed-carousel"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 16,
        color: "#0f172a",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16 }}>What guests say</strong>
        <span data-testid="rev058-embed-summary" style={{ fontSize: 14, color: "#475569" }}>
          {`${avgText} ★ · ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {reviews.slice(0, 3).map((r) => (
          <div
            key={r.id}
            data-testid={`rev058-review-card-${r.id}`}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              background: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <strong>{formatFirstName(r.reviewerName)}</strong>
              <span>{`${r.rating.toFixed(1)} ★`}</span>
            </div>
            {r.comment && <p style={{ margin: "0 0 6px", fontSize: 13, color: "#334155" }}>{r.comment}</p>}
            {r.source && <span style={{ fontSize: 11, color: "#64748b" }}>{`Verified via ${r.source}`}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
