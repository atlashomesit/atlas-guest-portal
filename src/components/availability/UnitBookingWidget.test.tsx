import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BookingProvider } from '../../contexts/BookingContext';
import { ListingPhotosProvider } from '../../contexts/ListingPhotosContext';
import UnitBookingWidget from './UnitBookingWidget';

// Mock dependencies
vi.mock('../../api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5001${path}`,
  getApiHeaders: () => ({}),
}));

vi.mock('../../runtime-config', () => ({
  hasRuntimeConfig: () => true,
}));

vi.mock('../../hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    dailyPrices: new Map(),
    effectiveDailyPricing: null,
  }),
}));

vi.mock('../../api/pricingClient', () => ({
  fetchCalendarPricing: vi.fn(),
  fetchPricingBreakdown: vi.fn(),
}));

vi.mock('../../utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({
    baseNightlyPrice: 5000,
    finalNightlyPrice: 5000,
    extraGuestFee: 500,
    appliedDiscountPercent: 0,
    hasSpecialDateMultiplier: false,
  })),
  inferUnitType: vi.fn(() => 'room'),
}));

vi.mock('../../utils/dateHelpers', () => ({
  calculateNights: (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / 86400000),
  formatNightCount: (n: number) => `${n} night${n > 1 ? 's' : ''}`,
  formatDateInTimezone: (date: Date) => date.toLocaleDateString(),
}));

vi.mock('../../utils/date', () => ({
  getIstStartOfDay: (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },
}));

vi.mock('../../utils/dateRange', () => ({
  doesRangeIntersectBlocked: () => false,
  toISODate: (date: Date) => date.toISOString().split('T')[0],
}));

vi.mock('../../utils/formatting', () => ({
  formatCurrency: (val: number) => `₹${val}`,
  formatHumanDate: (date: Date | string) => new Date(date).toLocaleDateString(),
}));

vi.mock('../../lib/http', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({
    getUrlsForListingId: vi.fn(() => []),
  }),
}));

vi.mock('../../components/date/AtlasDateRangePicker', () => ({
  AtlasDateRangePicker: ({ onChange }: any) => (
    <div data-testid="date-range-picker">
      <button onClick={() => onChange({ startDate: null, endDate: null })}>Clear</button>
    </div>
  ),
}));

vi.mock('../../components/ui/OptimizedImage', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}));

describe('UnitBookingWidget - TASK-1229/1215: Button disabled before dates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Book Now button until both check-in and check-out dates are selected', () => {
    render(
      <BrowserRouter>
        <BookingProvider>
          <ListingPhotosProvider>
            <UnitBookingWidget
              listingId={1}
              propertyId={1}
              listingName="Test Property"
              maxGuests={4}
            />
          </ListingPhotosProvider>
        </BookingProvider>
      </BrowserRouter>
    );

    const bookButton = screen.getByRole('button', { name: /Book Now/i });
    expect(bookButton).toBeDisabled();
  });
});
