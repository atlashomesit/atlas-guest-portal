import { describe, expect, vi, beforeEach, afterEach, it, test } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { act, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { getIstCalendarDate, getIstStartOfDay } from '@/utils/date';
import BookingCard from './BookingCard';
import { propertyData } from '../../../data';
import { BookingProvider } from '../../../contexts/BookingContext';

const getPrimaryCta = () =>  screen
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

describe('BookingCard (current simple form)', () => {
  it('renders Book Your Stay form with email, phone, terms and Book Now', async () => {
    await renderCard();
    expect(screen.getByRole('heading', { name: /book your stay/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I agree to the terms/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /book now/i })).toBeInTheDocument();
  });

  it('enables Book Now when email, phone and terms are filled', async () => {
    await renderCard();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'guest@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9999999999' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the terms/i }));
    const bookNow = screen.getByRole('button', { name: /book now/i });
    expect(bookNow).toBeEnabled();
  });
});
