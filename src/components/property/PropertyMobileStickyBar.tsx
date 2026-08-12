/**
 * DESIGN-003 — mobile sticky book bar with live total + free-cancel deadline when dates are picked.
 */
import React from "react";
import { formatCurrency } from "@/utils/formatting";
import type { BookingStickySummary } from "@/components/availability/UnitBookingWidget";

type Props = {
  bookable: boolean;
  nightlyFallback: number;
  nightlyIsSynthetic: boolean;
  summary: BookingStickySummary | null;
  onReserveClick: () => void;
};

export const PropertyMobileStickyBar: React.FC<Props> = ({
  bookable,
  nightlyFallback,
  nightlyIsSynthetic,
  summary,
  onReserveClick,
}) => {
  if (!bookable) {
    return (
      <div
        className="pp-m-sticky"
        aria-label="Listing not yet available for booking"
        data-testid="mobile-draft-notice"
      >
        <div className="pp-m-sticky-price" style={{ color: "var(--text-muted, #6b5a55)" }}>
          <b style={{ fontWeight: 600 }}>Not yet available</b>
          <span>for booking</span>
        </div>
      </div>
    );
  }

  const datesUnavailable = Boolean(summary?.datesUnavailable);
  const showLiveTotal =
    !datesUnavailable &&
    summary?.hasCompleteDates &&
    summary.totalAmount != null &&
    summary.totalAmount > 0;
  const pricingPending = summary?.pricingPending;

  return (
    <div className="pp-m-sticky" aria-label="Book this property" data-testid="mobile-reserve-bar">
      <div className="pp-m-sticky-price">
        {datesUnavailable ? (
          <>
            <b data-testid="mobile-sticky-unavailable" style={{ fontWeight: 600 }}>
              Dates unavailable
            </b>
            <span className="pp-m-sticky-taxes">Pick different nights</span>
          </>
        ) : showLiveTotal && !pricingPending ? (
          <>
            <b data-testid="mobile-sticky-total">{formatCurrency(summary!.totalAmount!, { maximumFractionDigits: 0 })}</b>
            <span> total</span>
            {summary?.freeCancelUntil ? (
              <span className="pp-m-sticky-taxes" data-testid="mobile-sticky-cancel-deadline">
                Free cancel until {summary.freeCancelUntil}
              </span>
            ) : (
              <span className="pp-m-sticky-taxes" data-testid="mobile-sticky-fees-included">
                all fees included
              </span>
            )}
          </>
        ) : showLiveTotal && pricingPending ? (
          <>
            <b style={{ fontWeight: 600 }}>Calculating…</b>
            <span className="pp-m-sticky-taxes">Updating your total</span>
          </>
        ) : (
          <>
            <b>{nightlyIsSynthetic ? "from " : ""}{formatCurrency(nightlyFallback, { maximumFractionDigits: 0 })}</b>
            <span>/ night</span>
            <span className="pp-m-sticky-taxes">+ taxes &amp; fees</span>
          </>
        )}
      </div>
      <button
        type="button"
        className="pp-btn pp-btn-primary pp-m-sticky-cta"
        onClick={onReserveClick}
        aria-label={datesUnavailable ? "Scroll to booking form to change dates" : "Scroll to booking form"}
      >
        {datesUnavailable ? "Change dates" : "Reserve"}
      </button>
    </div>
  );
};

export default PropertyMobileStickyBar;
