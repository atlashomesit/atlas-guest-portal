import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

export interface PublicTripSummaryDto {
  tenantBrand?: string | null;
  propertyName?: string | null;
  unitName?: string | null;
  propertyAddress?: string | null;
  googleMapsUrl?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  hostPhone?: string | null;
}

export const TripSummarySharePage: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [summary, setSummary] = useState<PublicTripSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareToken) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    api
      .get(`/public/trip-summary/${encodeURIComponent(shareToken)}`)
      .then((res) => {
        if (cancelled) return;
        if (res?.data) {
          setSummary(res.data as PublicTripSummaryDto);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center" data-testid="trip-summary-loading">
        <p className="text-sm text-text-secondary">Loading shared trip summary…</p>
      </main>
    );
  }

  if (notFound || !summary) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center" data-testid="trip-summary-not-found">
        <h1 className="text-xl font-bold text-text-primary">Trip summary link unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This shared link may have been disabled or expired by the guest.
        </p>
      </main>
    );
  }

  const mapsUrl =
    summary.googleMapsUrl?.trim() ||
    (summary.propertyAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.propertyAddress)}`
      : null);

  return (
    <main
      data-testid="trip-summary-page"
      className="mx-auto max-w-lg px-4 py-8 sm:py-12"
    >
      <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-sm">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
          Shared trip summary
        </div>

        {summary.tenantBrand && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
            {summary.tenantBrand}
          </p>
        )}

        <h1 className="mt-1 text-2xl font-bold text-text-primary break-words">
          {summary.propertyName || summary.unitName || "Your stay"}
        </h1>
        {summary.unitName && summary.propertyName && summary.unitName !== summary.propertyName && (
          <p className="text-sm text-text-secondary mt-0.5">{summary.unitName}</p>
        )}

        <p className="mt-2 text-xs text-text-secondary">
          Privacy-safe view: door codes, Wi-Fi passwords, and prices are hidden.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-bg-page border border-border-subtle p-4">
          <div>
            <div className="text-xs font-medium text-text-secondary">Check-in</div>
            <div className="mt-0.5 text-sm font-semibold text-text-primary" data-testid="trip-summary-checkin">
              {summary.checkInDate || "—"}
            </div>
            {summary.checkInTime && (
              <div className="text-xs text-text-secondary">{summary.checkInTime}</div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-text-secondary">Check-out</div>
            <div className="mt-0.5 text-sm font-semibold text-text-primary" data-testid="trip-summary-checkout">
              {summary.checkOutDate || "—"}
            </div>
            {summary.checkOutTime && (
              <div className="text-xs text-text-secondary">{summary.checkOutTime}</div>
            )}
          </div>
        </div>

        {summary.propertyAddress && (
          <div className="mt-4 rounded-xl bg-bg-page border border-border-subtle p-4">
            <div className="text-xs font-medium text-text-secondary">Address</div>
            <p className="mt-1 text-sm text-text-primary break-words" data-testid="trip-summary-address">
              {summary.propertyAddress}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="trip-summary-maps-btn"
              className="min-h-[44px] flex-1 inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition text-center"
            >
              Open in Google Maps
            </a>
          )}
          {summary.hostPhone && (
            <a
              href={`tel:${summary.hostPhone.replace(/\s+/g, "")}`}
              data-testid="trip-summary-call-btn"
              className="min-h-[44px] flex-1 inline-flex items-center justify-center rounded-xl border border-border-subtle bg-bg-page px-4 py-2.5 text-sm font-semibold text-text-primary hover:border-brand-primary transition text-center"
            >
              Call host
            </a>
          )}
        </div>
      </div>
    </main>
  );
};

export default TripSummarySharePage;
