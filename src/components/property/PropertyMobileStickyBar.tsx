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
import { trackEvent } from "@/utils/analytics";
import {
  FLOATER_STACK_CLEARANCE_PX,
  LISTING_FAQ_BODY_ATTR,
  NEAR_FOOTER_BODY_ATTR,
  OPEN_LISTING_FAQ_EVENT,
  OPEN_SUPPORT_EVENT,
  STICKY_BAR_OFFSET_VAR,
  STICKY_CHAT_BODY_ATTR,
} from "./propertyHelpEvents";
import "./PropertyMobileStickyBar.css";

/**
 * TOP10-2026-10-27-01-D: on phones the one Chat button in this bar replaces the floating host
 * WhatsApp bubble, FAQ help button and "Chat with us" pill. It offers a small chooser so the
 * host stays reachable (the support drawer's WhatsApp/Call are the platform's own contact, not
 * the host's): message the host, this listing's FAQs, and the existing support drawer.
 * The names are shared with SupportWidget / GuestAssistant through ./propertyHelpEvents.
 */

type Props = {
  bookable: boolean;
  nightlyFallback: number;
  nightlyIsSynthetic: boolean;
  summary: BookingStickySummary | null;
  /** Fallback when the date-picker sheet cannot be triggered (scrolls to the booking form). */
  onReserveClick: () => void;
  /**
   * wa.me link to the listing's HOST (same builder and number as the desktop host WhatsApp
   * bubble). Empty when the page has no host number: the chooser then omits the host entry.
   */
  hostWhatsAppUrl?: string;
  /** Listing id for analytics context only. */
  listingId?: number | string | null;
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
  hostWhatsAppUrl = "",
  listingId,
}) => {
  const bookingContentVisible = useBookingContentVisible();
  const barRef = React.useRef<HTMLDivElement>(null);
  const chatButtonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [faqAvailable, setFaqAvailable] = React.useState(false);
  // TOP10-2026-10-27-01-C: the bar is visible from the first view (price + next step on phone);
  // it still steps aside while the booking card itself is on screen.
  const isVisible = !bookingContentVisible;
  React.useEffect(() => {
    if (!bookable || typeof document === "undefined") return undefined;
    document.body.setAttribute(STICKY_CHAT_BODY_ATTR, "true");
    return () => document.body.removeAttribute(STICKY_CHAT_BODY_ATTR);
  }, [bookable]);

  // The support drawer sits above this bar (it lifts itself by this live height), and the bar
  // never reports a height while it is hidden or not shown at this width.
  React.useEffect(() => {
    if (!bookable || typeof document === "undefined") return undefined;
    const body = document.body;
    const bar = barRef.current;
    const apply = () => {
      const height = isVisible && bar ? Math.round(bar.getBoundingClientRect().height) : 0;
      body.style.setProperty(STICKY_BAR_OFFSET_VAR, `${height}px`);
    };
    apply();
    const observer = typeof ResizeObserver !== "undefined" && bar ? new ResizeObserver(apply) : null;
    if (observer && bar) observer.observe(bar);
    return () => {
      observer?.disconnect();
      body.style.removeProperty(STICKY_BAR_OFFSET_VAR);
    };
  }, [bookable, isVisible]);

  // At 1024px+ the floaters stack in the bottom-left gutter; they step aside while the footer
  // is within reach of that stack so they never cover footer links (CSS reads the attribute).
  React.useEffect(() => {
    if (!bookable || typeof window === "undefined") return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      const near = footer
        ? footer.getBoundingClientRect().top < window.innerHeight - FLOATER_STACK_CLEARANCE_PX
        : false;
      document.body.toggleAttribute(NEAR_FOOTER_BODY_ATTR, near);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const pageResize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    pageResize?.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      pageResize?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.body.removeAttribute(NEAR_FOOTER_BODY_ATTR);
    };
  }, [bookable]);

  const closeMenu = React.useCallback((restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) chatButtonRef.current?.focus();
  }, []);

  // The chooser closes on outside tap, Escape, and whenever the bar steps aside.
  React.useEffect(() => {
    if (!menuOpen) return undefined;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || chatButtonRef.current?.contains(target))) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);
  React.useEffect(() => {
    if (!isVisible) setMenuOpen(false);
  }, [isVisible]);

  const openSupportDrawer = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_EVENT));
  }, []);

  const handleChat = React.useCallback(() => {
    const hasListingFaq = document.body.hasAttribute(LISTING_FAQ_BODY_ATTR);
    // Nothing to choose between: open the support drawer straight away, as before.
    if (!hostWhatsAppUrl && !hasListingFaq) {
      openSupportDrawer();
      return;
    }
    setFaqAvailable(hasListingFaq);
    setMenuOpen((open) => !open);
  }, [hostWhatsAppUrl, openSupportDrawer]);

  // Focus goes back to the Chat button first, so the drawer / FAQ panel (which return focus to
  // whatever held it when they opened) hand it back to a control that still exists.
  const handleMenuSupport = React.useCallback(() => {
    chatButtonRef.current?.focus();
    setMenuOpen(false);
    openSupportDrawer();
  }, [openSupportDrawer]);
  const handleMenuFaq = React.useCallback(() => {
    chatButtonRef.current?.focus();
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_LISTING_FAQ_EVENT));
  }, []);
  const handleMenuHost = React.useCallback(() => {
    setMenuOpen(false);
    trackEvent("whatsapp_cta_click", { surface: "sticky_bar", listingId: listingId ?? undefined });
  }, [listingId]);

  const canReviewBooking = Boolean(summary?.canReviewBooking && summary.hasCompleteDates && !summary.datesUnavailable && !summary.pricingPending && summary.totalAmount != null && summary.totalAmount > 0);

  const handleReserve = React.useCallback(() => {
    const form =
      document.querySelector<HTMLElement>(STICKY_BAR_BOOKING_FORM_SELECTOR) ??
      document.querySelector<HTMLElement>("[data-booking-widget]");
    if (canReviewBooking) {
      const submit = form?.querySelector<HTMLButtonElement>('[data-testid="guest-booking-submit"]');
      // GUEST-040: one tap goes straight to checkout. The form's own Reserve handler hands the stay to the details page
      // (dates, guests, rate plan, quote, add-ons) with no network call, so the sticky bar presses that same button
      // instead of scrolling the guest back up to find it. The form reflects the current widget render even before
      // its summary effect propagates, so readiness is re-read from it.
      if (form?.dataset.canReviewBooking === "true" && submit && !submit.disabled) {
        submit.click();
        return;
      }
    }
    // GUEST-040: a required control the guest has not filled in is brought into view (and focused) instead of
    // leaving them on a bar that does nothing.
    const unfulfilled = form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-required-missing="true"]');
    if (unfulfilled) {
      unfulfilled.scrollIntoView({ behavior: "smooth", block: "center" });
      unfulfilled.focus({ preventScroll: true });
      return;
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
      ref={barRef}
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
        ref={chatButtonRef}
        type="button"
        className="pp-m-sticky-chat"
        data-testid="mobile-sticky-chat"
        onClick={handleChat}
        tabIndex={isVisible ? 0 : -1}
        aria-label="Chat with us: WhatsApp, call, FAQs"
        aria-haspopup={hostWhatsAppUrl ? "menu" : undefined}
        aria-expanded={hostWhatsAppUrl ? menuOpen : undefined}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />
        </svg>
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          className="pp-m-chat-menu"
          role="menu"
          aria-label="Contact options"
          data-testid="mobile-sticky-chat-menu"
        >
          {hostWhatsAppUrl && (
            <a
              className="pp-m-chat-menu-item"
              role="menuitem"
              href={hostWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mobile-sticky-chat-host"
              onClick={handleMenuHost}
            >
              <span>
                <b>Message the host</b>
                <small>WhatsApp about this property</small>
              </span>
            </a>
          )}
          {faqAvailable && (
            <button
              type="button"
              className="pp-m-chat-menu-item"
              role="menuitem"
              data-testid="mobile-sticky-chat-faq"
              onClick={handleMenuFaq}
            >
              <span>
                <b>Questions about this stay</b>
                <small>Answers the host added for this listing</small>
              </span>
            </button>
          )}
          <button
            type="button"
            className="pp-m-chat-menu-item"
            role="menuitem"
            data-testid="mobile-sticky-chat-support"
            onClick={handleMenuSupport}
          >
            <span>
              <b>Booking and payment help</b>
              <small>WhatsApp, call or callback</small>
            </span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="pp-btn pp-btn-primary pp-m-sticky-cta"
        data-testid="mobile-sticky-book-now"
        onClick={handleReserve}
        tabIndex={isVisible ? 0 : -1}
        aria-label={canReviewBooking ? `Reserve and continue to checkout, ${formatCurrency(summary!.totalAmount!, { maximumFractionDigits: 0 })} total` : datesUnavailable ? "Open date picker to change dates" : "Open date picker to book"}
      >
        {canReviewBooking ? `Reserve — ${formatCurrency(summary!.totalAmount!, { maximumFractionDigits: 0 })}` : datesUnavailable ? "Change dates" : "Reserve"}
      </button>
    </div>
  );
};

export default PropertyMobileStickyBar;
