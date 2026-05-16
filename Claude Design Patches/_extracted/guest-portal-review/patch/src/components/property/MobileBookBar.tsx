import React, { useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { formatCurrency } from '@/utils/formatting';
import { calculateNights } from '@/utils/dateHelpers';
import {
  freeCancelByDate,
  fmtShortDay,
  type CancellationTier,
} from './cancellationTimeline';
import { track } from '@/lib/events';

/**
 * Persistent bottom CTA bar on the property detail page (mobile only).
 *
 * Replaces the current mobile pattern where the booking widget renders
 * above the photos (Homepage_PropertyDetails.tsx L1762: `order-1 sm:order-2`).
 * After the May 2026 reorder fix, the booking widget sits at the bottom of
 * the page — but the price and CTA must remain visible while the guest
 * scrolls through amenities, the trust band, the map, and reviews.
 *
 * This component does NOT duplicate UnitBookingWidget's pricing maths. v1
 * shows the nightly rate (plus, if dates are picked, the night count and
 * free-cancel deadline). Tapping "Reserve" smooth-scrolls the page to
 * `#booking-form` — the existing widget owns the actual booking action.
 *
 * Hidden ≥ sm breakpoint via Tailwind. Respects iOS safe-area insets so
 * it does not collide with the home indicator.
 */
export interface MobileBookBarProps {
  /** Base nightly rate in INR — from Property.property_price. */
  nightlyRate: number;
  /** Cancellation tier from the listing record; drives the free-cancel date. */
  cancellationTier?: CancellationTier | null;
  /** Optional listing name — used in the analytics event. */
  listingName?: string;
}

const MobileBookBar: React.FC<MobileBookBarProps> = ({
  nightlyRate,
  cancellationTier,
  listingName,
}) => {
  const { booking } = useBooking();

  const checkIn = booking.checkIn ? new Date(booking.checkIn) : null;
  const checkOut = booking.checkOut ? new Date(booking.checkOut) : null;
  const nights = (checkIn && checkOut) ? calculateNights(checkIn, checkOut) : 0;
  const hasDates = nights > 0;

  const tier: CancellationTier = cancellationTier ?? 'Flexible';
  const freeBy = freeCancelByDate(tier, checkIn);

  const handleReserve = useCallback(() => {
    track('mobile_bookbar_reserve_clicked', {
      hasDates,
      nights,
      listingName: listingName ?? null,
    });
    const target = document.getElementById('booking-form');
    if (!target) return;
    // Smooth-scroll without scrollIntoView (per house style: scrollIntoView
    // is banned because it can disturb the surrounding scroll container).
    const top = target.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: 'smooth' });
    // Focus the form for screen-reader users once the scroll settles.
    window.setTimeout(() => {
      const firstFocusable = target.querySelector<HTMLElement>('button, input, select');
      firstFocusable?.focus({ preventScroll: true });
    }, 380);
  }, [hasDates, nights, listingName]);

  return (
    <div
      role="region"
      aria-label="Booking summary"
      data-testid="mobile-bookbar"
      className="sm:hidden fixed inset-x-0 bottom-0 z-[var(--z-sticky)] bg-bg-surface border-t border-border-subtle"
      style={{
        // 0 2px 8px upward, mirroring resting shadow but pointing up
        boxShadow: '0 -8px 24px rgba(26, 26, 46, 0.06), 0 -1px 3px rgba(26, 26, 46, 0.04)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          {hasDates ? (
            <>
              <p
                className="text-xl leading-none font-semibold text-text-primary m-0 tabular-nums"
                style={{ fontFamily: 'var(--font-family-display, "Cormorant Garamond", serif)' }}
              >
                {formatCurrency(nightlyRate * nights, 'INR')}
                <span className="ml-1.5 text-xs font-medium text-text-muted font-sans">
                  · {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
              </p>
              <p className="text-[11px] text-text-muted m-0 mt-1.5 leading-snug">
                {freeBy ? (
                  <>Free cancel until <strong className="text-text-primary font-semibold">{fmtShortDay(freeBy)}</strong> · taxes extra</>
                ) : (
                  <>Taxes calculated at checkout</>
                )}
              </p>
            </>
          ) : (
            <>
              <p
                className="text-xl leading-none font-semibold text-text-primary m-0 tabular-nums"
                style={{ fontFamily: 'var(--font-family-display, "Cormorant Garamond", serif)' }}
              >
                {formatCurrency(nightlyRate, 'INR')}
                <span className="ml-1.5 text-xs font-medium text-text-muted font-sans">/ night</span>
              </p>
              <p className="text-[11px] text-text-muted m-0 mt-1.5 leading-snug flex items-center gap-1">
                <ShieldCheck size={12} aria-hidden /> Verified · Razorpay
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleReserve}
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-cta-primary text-white font-semibold text-sm shadow-level1 hover:bg-cta-primaryHover active:translate-y-px transition-colors flex-shrink-0"
          data-testid="mobile-bookbar-cta"
        >
          {hasDates ? 'Reserve' : 'Check availability'}
        </button>
      </div>
    </div>
  );
};

export default MobileBookBar;
