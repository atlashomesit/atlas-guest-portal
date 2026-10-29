import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AtlasBookingCalendar } from './AtlasBookingCalendar';

// GUEST-048: the date sheet's per-day figures are calendar rates, not the checkout quote - the sheet says where the real price is.
const anchor = (() => {
  const btn = document.createElement('button');
  document.body.appendChild(btn);
  return { current: btn };
})();

const props = (prices: Map<string, number>) => ({
  open: true,
  onClose: vi.fn(),
  anchorRef: anchor,
  value: { startDate: null, endDate: null },
  onChange: vi.fn(),
  today: new Date('2026-09-16'),
  minDate: new Date('2026-09-15'),
  maxDate: new Date('2027-09-16'),
  disabledDay: () => false,
  dateStatusMap: new Map(),
  calendarDailyPrices: prices,
  fallbackPrice: null,
  pricingLoading: false,
  shownDate: new Date(2026, 8, 1),
  onShownDateChange: vi.fn(),
});

describe('AtlasBookingCalendar price note (GUEST-048)', () => {
  it('shows the note when per-day prices are painted', () => {
    render(<AtlasBookingCalendar {...props(new Map([['2026-09-18', 3150]]))} />);
    expect(screen.getByTestId('booking-calendar-price-note')).toHaveTextContent('Prices per night are a guide');
  });
  it('shows no note when there are no prices to qualify', () => {
    render(<AtlasBookingCalendar {...props(new Map())} />);
    expect(screen.queryByTestId('booking-calendar-price-note')).toBeNull();
  });
});