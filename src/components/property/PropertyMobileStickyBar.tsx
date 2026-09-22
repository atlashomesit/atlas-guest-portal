/**
 * DESIGN-003 — mobile sticky book bar with live total + free-cancel deadline when dates are picked.
 * TASK-102075 — scroll-triggered appearance (IntersectionObserver on the hero gallery card,
 * falling back to the booking form) + primary action opens the existing date-picker bottom
 * sheet (AtlasBookingCalendar via the UnitBookingWidget check-in trigger) directly.
 */
import React from "react";
import { formatCurrency } from "@/utils/formatting";
import type { BookingStickySummary } from "@/components/availability/UnitBookingWidget";

type Props = {
  bookable: boolean;
  nightlyFallback: number;
  nightlyIsSynthetic: boolean;
  summary: BookingStickySummary | null;
  /** Fallback when the date-picker sheet cannot be triggered (scrolls to the booking form). */
  onReserveClick: () => void;
};

/** Hero card observed first: the bar appears once the guest scrolls past it. */
export const STICKY_BAR_HERO_SELECTOR = '[data-testid="property-photo-gallery"]';
/** Fallback sentinel when the hero gallery is absent: the top booking card / form. */
export const STICKY_BAR_BOOKING_FORM_SELECTOR = '[data-testid="guest-booking-form"]';
/**
 * Existing openers for the property-page date picker (UnitBookingWidget check-in cell).
 * Clicking one sets `openCalendar` on the widget, which renders AtlasBookingCalendar —
 * a fixed bottom sheet on narrow viewports. No second picker is built here.
 */
export const DATE_SHEET_TRIGGER_SELECTORS = [
  "#unit-booking-dates",
  '[aria-label="Select check-in date"]',
] as const;

/**
 * Clicks the existing date-picker trigger on the property page, opening the
 * AtlasBookingCalendar bottom sheet. Returns true when a trigger was found and
 * clicked, false when the caller should fall back (e.g. scroll to the form).
 */
export function tryOpenPropertyDateSheet(doc: Document = document): boolean {
  for (const selector of DATE_SHEET_TRIGGER_SELECTORS) {
    const trigger = doc.querySelector(selector) as HTMLElement | null;
    if (trigger) {
      trigger.click();
      return true;
    }
  }
  return false;
}

/**
 * Mobile-only visibility: hidden near the top of the page, shown (smoothly, via
 * transform/opacity transition) once the hero card has scrolled out of view.
 * Defaults to visible when there is nothing to observe (no IntersectionObserver,
 * e.g. jsdom, or no sentinel in the DOM) so the bar never disappears on
 * unsupported setups. Desktop layout is untouched — `.pp-m-sticky` stays
 * `display: none` outside the mobile media query.
 */
function useStickyBarVisibility(): boolean {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof document === "undefined" || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const sentinel =
      document.querySelector(STICKY_BAR_HERO_SELECTOR) ??
      document.querySelector(STICKY_BAR_BOOKING_FORM_SELECTOR);
    if (!sentinel) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Show only once the sentinel has scrolled *above* the viewport
          // (boundingClientRect.top < 0) — a booking form sitting below the fold
          // on first paint must NOT reveal the bar.
          const top = entry.boundingClientRect?.top ?? -1;
          setVisible(!entry.isIntersecting && top < 0);
        }
      },
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return visible;
}

export const PropertyMobileStickyBar: React.FC<Props> = ({
  bookable,
  nightlyFallback,
  nightlyIsSynthetic,
  summary,
  onReserveClick,
}) => {
  const pastHero = useStickyBarVisibility();

  const handleReserve = React.useCallback(() => {
    // Primary: open the existing date-picker bottom sheet directly. It renders
    // fixed on mobile, so no scroll is needed. Fallback: scroll to the form.
    if (tryOpenPropertyDateSheet()) return;
    onReserveClick();
  }, [onReserveClick]);

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
    <div
      className="pp-m-sticky"
      aria-label="Book this property"
      aria-hidden={!pastHero}
      data-testid="mobile-reserve-bar"
      data-visible={pastHero ? "true" : "false"}
      style={{
        transform: pastHero ? "translateY(0)" : "translateY(110%)",
        opacity: pastHero ? 1 : 0,
        pointerEvents: pastHero ? "auto" : "none",
        transition: "transform 0.3s ease, opacity 0.3s ease",
      }}
    >
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
        data-testid="mobile-sticky-book-now"
        onClick={handleReserve}
        tabIndex={pastHero ? 0 : -1}
        aria-label={datesUnavailable ? "Open date picker to change dates" : "Open date picker to book"}
      >
        {datesUnavailable ? "Change dates" : "Reserve"}
      </button>
    </div>
  );
};

export default PropertyMobileStickyBar;
