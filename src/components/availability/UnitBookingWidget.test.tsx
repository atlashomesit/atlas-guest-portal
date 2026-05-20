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

  it('has .bw-head header block with "From" and "/ night" copy', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('bw-head');
    expect(content).toContain('bw-price-block');
    expect(content).toContain('bw-from');
    expect(content).toContain('bw-amount');
    expect(content).toContain('From');
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

  it('GST label includes "on accommodation" and "On accommodation only" sublabel', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('on accommodation');
    expect(content).toContain('On accommodation only');
  });

  it('service fee label replaces "Convenience fee"', () => {
    content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('Service fee');
    // "Convenience fee" should not appear as the primary label
    expect(content).not.toContain('>Convenience fee');
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
