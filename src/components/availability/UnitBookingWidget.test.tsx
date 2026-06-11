import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AxiosError } from 'axios';
import {
  getOrderCreationGuestErrorMessage,
  PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT,
} from './unitBookingPaymentOrderErrors';

describe('UnitBookingWidget - TASK-2460: order API errors surface body.message', () => {
  it('422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT includes API message and WhatsApp hint', () => {
    const apiMessage = 'Online payment is not configured for this property.';
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      statusText: 'Unprocessable Entity',
      data: {
        code: 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT',
        message: apiMessage,
      },
      headers: {},
      config: {} as never,
    });
    const text = getOrderCreationGuestErrorMessage(err, 'fallback');
    expect(text).toContain(apiMessage);
    expect(text).toContain(PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT);
  });
});

describe('UnitBookingWidget - TASK-2612: Button text is "Reserve" (two-step flow)', () => {
  it('button text contains "Reserve" and not "Book Now" after TASK-2612 two-step flow', () => {
    const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
    const content = readFileSync(filePath, 'utf-8');

    // TASK-2612: Reserve button — widget only does init-hold, form is on GuestDetailsPage
    expect(content).toContain("'Reserve'");
    expect(content).not.toContain("'Book Now'");

    // Verify the button has disabled conditions including date checks
    expect(content).toContain('!dateRange.startDate');
    expect(content).toContain('!dateRange.endDate');
  });
});

describe('UnitBookingWidget - TASK-2623: .bw-* design header, price labels, trust strip', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
  let content: string;

  it('reads widget source', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toBeTruthy();
  });

  it('has v2 headline block with per-night price display and "/ night" copy (listing-detail-v2 redesign)', () => {
    // v2 redesign (2026-05-21): lv-booking-headline replaces bw-head/bw-price-block.
    // bw-* layout classes removed; lv-* design tokens now drive the headline.
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('lv-booking-headline');
    expect(content).toContain('lv-booking-total');
    expect(content).toContain('/ night');
  });

  it('renders AtlasBookingCalendar (not a legacy plain calendar)', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('AtlasBookingCalendar');
    // Legacy react-date-range should not be used directly
    expect(content).not.toContain('react-date-range');
  });

  it('has reviewRating and reviewCount props for bw-rating block', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('reviewRating');
    expect(content).toContain('reviewCount');
    expect(content).toContain('bw-rating');
    // Rating block only shown when reviewCount > 0
    expect(content).toContain('reviewCount > 0');
  });

  it('price breakdown uses "× N nights" subtotal label (not "Room fare")', () => {
    content = readFileSync(filePath, 'utf-8');
    // New label should contain × N nights
    expect(content).toContain('× ${priceDetails.nights}');
    // Legacy "Room fare" label should be gone
    expect(content).not.toContain('>Room fare<');
  });

  it('GST row is standardized to "GST (N%)" with no redundant "on accommodation" sublabel (TASK-4097)', () => {
    content = readFileSync(filePath, 'utf-8');
    // TASK-4097 (PR #242, commit 54200ec3) deliberately dropped the redundant
    // "on accommodation" sublabel and standardized the GST row to "GST (N%)".
    expect(content).toContain('GST ({gstSlabPercent}%)');
    expect(content).not.toContain('on accommodation');
  });

  it('payment-processing label replaces older "Service fee" / "Convenience fee" wording (TASK-2633)', () => {
    content = readFileSync(filePath, 'utf-8');
    // Honest label — "Payment processing" makes clear the 3% is a Razorpay pass-through, not an Atlas markup.
    expect(content).toContain('Payment processing');
    // Older labels must not appear as the primary user-visible label.
    expect(content).not.toContain('>Convenience fee');
    expect(content).not.toContain('Service fee');
  });

  it('has "You won\'t be charged yet" microcopy after Reserve', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("bw-charge-note");
    expect(content).toContain("won");
    expect(content).toContain("charged yet");
  });

  it('has "Free cancellation until 48 hours before check-in" trust strip', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('bw-trust');
    expect(content).toContain('Free cancellation until 48 hours before check-in');
  });

  it('passes holdListingName to updateBooking in handleReserve', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('holdListingName');
    expect(content).toContain('listingName ?? null');
  });
});

describe('UnitBookingWidget - TASK-2630: URL date hydration and picker interaction', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');
  let content: string;

  it('hydrates dateRange from BookingContext on mount', () => {
    content = readFileSync(filePath, 'utf-8');
    // Check hydration effect exists and reads from booking context
    expect(content).toContain('booking.checkIn');
    expect(content).toContain('booking.checkOut');
    expect(content).toContain('setDateRange');
    // Hydration should convert ISO strings to Date objects
    expect(content).toContain('getIstStartOfDay(new Date(ci))');
    expect(content).toContain('getIstStartOfDay(new Date(co))');
  });

  it('passes dateRange value to AtlasBookingCalendar as controlled value prop', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('value={dateRange}');
    expect(content).toContain('<AtlasBookingCalendar');
  });

  it('date row button has onClick handler that opens the calendar', () => {
    content = readFileSync(filePath, 'utf-8');
    // Button with id="unit-booking-dates" should have onClick that calls setOpenCalendar(true)
    expect(content).toContain('id="unit-booking-dates"');
    expect(content).toContain('setOpenCalendar(true)');
  });

  it('includes data-testid="price-line-base" on the base rate row for trip-wire testing', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('price-line-base');
  });
});

describe('UnitBookingWidget - TASK-2870: accommodation GST uses 18% slab above ₹7,500', () => {
  const filePath = resolve(__dirname, './UnitBookingWidget.tsx');

  it('uses shared guestPriceEstimate GST helpers (not retired 12% slab)', () => {
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('accommodationGstSlabPercent');
    expect(content).toContain('accommodationGstLineAmount');
    expect(content).not.toMatch(/<= 7500 \? 5 : 12/);
    expect(content).not.toContain('else 12%');
  });
});
