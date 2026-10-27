/**
 * DESIGN-003 — mobile sticky book bar with live total + free-cancel deadline when dates are picked.
 * TASK-102075 — scroll-triggered appearance (IntersectionObserver on the hero gallery card,
 * falling back to the booking form) + primary action opens the existing date-picker bottom
 * sheet (AtlasBookingCalendar via the UnitBookingWidget check-in trigger) directly.
 */
import React from "react";
import { formatCurrency } from "@/utils/formatting";
import type { BookingStickySummary } from "@/components/availability/UnitBookingWidget";
import { useBookingContentVisible } from "@/hooks/useBookingContentVisible";
import { isInternalOrDefaultRatePlanName } from "@/components/pricing/PricingTierDisplay";
import { plainMealLabel } from "@/utils/directBookingPrice";
import "./PropertyMobileStickyBar.css";

/**
 * TOP10-2026-10-27-01-D: on phones the one Chat button in this bar replaces the floating host
 * WhatsApp bubble, FAQ help button and "Chat with us" pill. It opens the existing support drawer
 * (WhatsApp, call, FAQs) through this window event; SupportWidget listens for it.
 */
export const OPEN_SUPPORT_EVENT = "atlas:open-support";
/** Body attribute that lets CSS hide the floaters (phones only) while this bar is mounted. */
export const STICKY_CHAT_BODY_ATTR = "data-pp-sticky-chat";

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

export const PropertyMobileStickyBar: React.FC<Props> = ({
  bookable,
  nightlyFallback,
  nightlyIsSynthetic,
  summary,
  onReserveClick,
}) => {
  const bookingContentVisible = useBookingContentVisible();
  // TOP10-2026-10-27-01-C: the bar is visible from the first view (price + next step on phone);
  // it still steps aside while the booking card itself is on screen.
  const isVisible = !bookingContentVisible;
  React.useEffect(() => {
    if (!bookable || typeof document === "undefined") return undefined;
    document.body.setAttribute(STICKY_CHAT_BODY_ATTR, "true");
    return () => document.body.removeAttribute(STICKY_CHAT_BODY_ATTR);
  }, [bookable]);

  const handleChat = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT));
  }, []);

  const canReviewBooking = Boolean(summary?.canReviewBooking && summary.hasCompleteDates && !summary.datesUnavailable && !summary.pricingPending && summary.totalAmount != null && summary.totalAmount > 0);

  const handleReserve = React.useCallback(() => {
    if (canReviewBooking) {
      const form =
        document.querySelector<HTMLElement>(STICKY_BAR_BOOKING_FORM_SELECTOR) ??
        document.querySelector<HTMLElement>("[data-booking-widget]");
      const submit = form?.querySelector<HTMLButtonElement>('[data-testid="guest-booking-submit"]');
      // The form reflects the current widget render even before its summary effect propagates.
      if (form?.dataset.canReviewBooking === "true" && submit && !submit.disabled) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        form.focus({ preventScroll: true });
        return;
      }
    }
    // Primary: open the existing date-picker bottom sheet directly. It renders
    // fixed on mobile, so no scroll is needed. Fallback: scroll to the form.
    if (tryOpenPropertyDateSheet()) return;
    onReserveClick();
  }, [canReviewBooking, onReserveClick]);

  const handleChangePlan = React.useCallback(() => {
    const form =
      document.querySelector<HTMLElement>(STICKY_BAR_BOOKING_FORM_SELECTOR) ??
      document.querySelector<HTMLElement>("[data-booking-widget]");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      form.focus({ preventScroll: true });
      return;
    }
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
  const rawPlanLabel = summary?.ratePlanLabel?.trim() || null;
  const safePlanLabel =
    rawPlanLabel && !isInternalOrDefaultRatePlanName(rawPlanLabel) ? rawPlanLabel : null;
  const mealText =
    summary?.mealPlanLabel?.trim() || summary?.mealPlanCode?.trim()
      ? plainMealLabel(summary?.mealPlanLabel || summary?.mealPlanCode)
      : null;
  const ratePlanBadgeText = [
    safePlanLabel,
    mealText && mealText !== safePlanLabel ? mealText : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="pp-m-sticky"
      aria-label="Book this property"
      aria-hidden={!isVisible}
      data-testid="mobile-reserve-bar"
      data-visible={isVisible ? "true" : "false"}
      style={{
        transform: isVisible ? "translateY(0)" : "translateY(110%)",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
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
            {ratePlanBadgeText && (
              <span
                className="pp-m-sticky-rate-plan"
                data-testid="mobile-sticky-rate-plan"
                style={{ display: "block", fontSize: 11, fontWeight: 600 }}
              >
                {ratePlanBadgeText}
              </span>
            )}
            {summary?.stayLabel && (
              <span className="pp-m-sticky-taxes" data-testid="mobile-sticky-stay">
                {summary.stayLabel}
              </span>
            )}
            {summary?.freeCancelUntil ? (
              <span className="pp-m-sticky-taxes" data-testid="mobile-sticky-cancel-deadline">
                Free cancel until {summary.freeCancelUntil}
              </span>
            ) : (
              <span className="pp-m-sticky-taxes" data-testid="mobile-sticky-fees-included">
                all fees included
              </span>
            )}
            {summary?.hasMultipleRatePlans && (
              <button
                type="button"
                data-testid="mobile-sticky-change-plan"
                onClick={handleChangePlan}
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  fontSize: 11,
                  textDecoration: "underline",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Change plan / details
              </button>
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
            <span className="pp-m-sticky-taxes">all fees included</span>
          </>
        )}
      </div>
      <button
        type="button"
        className="pp-m-sticky-chat"
        data-testid="mobile-sticky-chat"
        onClick={handleChat}
        tabIndex={isVisible ? 0 : -1}
        aria-label="Chat with us: WhatsApp, call, FAQs"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
        </svg>
      </button>
      <button
        type="button"
        className="pp-btn pp-btn-primary pp-m-sticky-cta"
        data-testid="mobile-sticky-book-now"
        onClick={handleReserve}
        tabIndex={isVisible ? 0 : -1}
        aria-label={canReviewBooking ? "Review selected dates and price" : datesUnavailable ? "Open date picker to change dates" : "Open date picker to book"}
      >
        {canReviewBooking ? "Review booking" : datesUnavailable ? "Change dates" : "Reserve"}
      </button>
    </div>
  );
};

export default PropertyMobileStickyBar;
