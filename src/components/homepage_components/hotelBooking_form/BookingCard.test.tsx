import { describe, expect, vi, beforeEach, afterEach, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BookingCard from './BookingCard';
import { BookingProvider } from '../../../contexts/BookingContext';

const _getPrimaryCta = () =>
  screen
    .getAllByRole('button', { name: /check availability/i })
    .find((button) => button.hasAttribute('disabled')) ??
  screen.getByRole('button', { name: /check availability/i });

const scrollIntoViewSpy = vi.fn();

const mockTrackEvent = vi.fn();
const mockLogUserAction = vi.fn();
const mockLogApiError = vi.fn();
const mockUpdateBooking = vi.fn();
const mockApiGet = vi.fn(async () => ({
  data: { bookings: [] },
  status: 200,
  headers: new Headers(),
  url: '/bookings',
}));

const razorpayOpen = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  asArray: (val: unknown) => (Array.isArray(val) ? val : []),
}));

vi.mock('@/runtime-config', () => ({
  hasRuntimeConfig: () => true,
  getApiBaseUrl: () => 'https://api.test',
  getGlobalDiscountPercent: () => 0,
}));

vi.mock('../../../contexts/BookingContext', () => ({
  useBooking: () => ({ updateBooking: mockUpdateBooking }),
  BookingProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('@/lib/monitoring', () => ({
  logUserAction: (...args: unknown[]) => mockLogUserAction(...args),
  logApiError: (...args: unknown[]) => mockLogApiError(...args),
  monitoredFetch: vi.fn(),
  isAtlasApiRequest: vi.fn(),
}));

vi.mock('react-date-range', () => {
  const DateRange = (props: { onChange: (arg: { selection: { startDate: Date; endDate: Date } }) => void }) => {
    return (
      <div data-testid="date-range-mock">
        <button
          type="button"
          onClick={() =>
            props.onChange({
              selection: {
                startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
              },
            })
          }
        >
          Select future dates
        </button>
        <button
          type="button"
          onClick={() =>
            props.onChange({
              selection: {
                startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            })
          }
        >
          Select past dates
        </button>
        <span data-testid="min-date-prop">{props.minDate?.toISOString()}</span>
      </div>
    );
  };

  return { DateRange };
});

const renderCard = async (propertyId = 101) => {
  let utils: ReturnType<typeof render> | undefined;
  await act(async () => {
    utils = render(
      <MemoryRouter>
        <BookingProvider>
          <BookingCard propertyId={propertyId} />
        </BookingProvider>
      </MemoryRouter>,
    );
  });
  return utils!;
};

beforeEach(() => {
  mockTrackEvent.mockClear();
  mockLogApiError.mockClear();
  mockLogUserAction.mockClear();
  mockApiGet.mockClear();
  razorpayOpen.mockClear();
  scrollIntoViewSpy.mockClear();
  const RazorpayMock = vi.fn(function RazorpayMock() {
    return { open: razorpayOpen };
  });
  vi.stubGlobal('Razorpay', RazorpayMock);
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
  // jsdom doesn't implement scrollIntoView
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: scrollIntoViewSpy,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookingCard (date search strip)', () => {
  it('renders Find your stay with dates, guests, and Search', async () => {
    await renderCard();
    expect(screen.getByRole('heading', { name: /find your stay/i })).toBeInTheDocument();
    expect(screen.getByText('Check-in')).toBeInTheDocument();
    expect(screen.getByText('Check-out')).toBeInTheDocument();
    expect(screen.getByText('Guests')).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="date"]').length).toBe(2);
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
  });

  // The guest count must survive being CLEARED. A controlled numeric input whose onChange
  // coerces empty back to a number (this field used to do Math.max(1, parseInt(v) || 1))
  // cannot be edited on a mobile keyboard at all: backspacing to empty is instantly undone,
  // so the default "1" can only be appended to ("13"), never replaced. Desktop hides this
  // behind the spinner arrows. Same defect class as the admin-portal guest-count bug.
  describe('guest count is editable on mobile', () => {
    it('can be cleared instead of snapping back to 1', async () => {
      await renderCard();
      const guests = screen.getByRole('spinbutton');

      fireEvent.change(guests, { target: { value: '' } });

      expect(guests).toHaveValue(null);
    });

    it('accepts a value typed after clearing', async () => {
      await renderCard();
      const guests = screen.getByRole('spinbutton');

      fireEvent.change(guests, { target: { value: '' } });
      fireEvent.change(guests, { target: { value: '3' } });

      expect(guests).toHaveValue(3);
    });

    it('clamps back to 1 on blur when left empty', async () => {
      await renderCard();
      const guests = screen.getByRole('spinbutton');

      fireEvent.change(guests, { target: { value: '' } });
      fireEvent.blur(guests);

      expect(guests).toHaveValue(1);
    });
  });

  it('Search button is enabled with default dates', async () => {
    await renderCard();
    const search = screen.getByRole('button', { name: /^search$/i });
    expect(search).toBeEnabled();
  });
});
