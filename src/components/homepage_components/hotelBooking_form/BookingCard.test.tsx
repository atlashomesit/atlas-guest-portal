import { describe, expect, vi, beforeEach, afterEach, it, test } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import BookingCard from './BookingCard';
import { propertyData } from '../../../data';
import { BookingProvider } from '../../../contexts/BookingContext';

const getPrimaryCta = () =>
  screen
    .getAllByRole('button', { name: /check availability/i })
    .find((button) => button.hasAttribute('disabled')) ??
  screen.getByRole('button', { name: /check availability/i });

const scrollIntoViewSpy = vi.fn();

const mockTrackEvent = vi.fn();
const mockLogUserAction = vi.fn();
const mockLogApiError = vi.fn();
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
  const DateRange = (props: any) => {
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
  // jsdom doesn't implement scrollIntoView
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: scrollIntoViewSpy,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BookingCard end-to-end flow', () => {
  it('walks through availability check, validation, and Razorpay init without redirects', async () => {
    await renderCard();
    fireEvent.click(screen.getByRole('button', { name: /check-in/i }));
    const dateRange = await screen.findByTestId('date-range-mock');
    fireEvent.click(within(dateRange).getByText(/select future dates/i));

    expect(screen.getAllByText(/dates updated for your stay/i).length).toBeGreaterThan(0);

    const inlineCta = screen
      .getAllByRole('button', { name: /check availability/i })
      .find((button) => !button.hasAttribute('disabled'))!;
    fireEvent.click(inlineCta);

    expect(document.getElementById('pricing-breakdown')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'guest@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9999999999' } });
    fireEvent.click(screen.getByLabelText(/i agree to the/i));

    const primaryCta = screen
      .getAllByRole('button', { name: /book now/i })
      .find((button) => !button.hasAttribute('disabled'))!;
    fireEvent.click(primaryCta);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      'availability_search',
      expect.objectContaining({ guests: expect.any(Number) }),
      expect.objectContaining({ propertyId: expect.any(Number) }),
    );

    expect(razorpayOpen).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });

  it('enforces form and terms validation states', async () => {
    await renderCard();

    const primaryCta = getPrimaryCta();
    expect(primaryCta).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'guest@example.com' } });
    expect(primaryCta).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '9999999999' } });
    expect(primaryCta).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/i agree to the/i));
    const bookNowButtons = screen.getAllByRole('button', { name: /book now/i });
    expect(bookNowButtons.some((button) => !button.hasAttribute('disabled'))).toBe(true);
  });

  it('prevents past date selection and keeps start date at or after today', async () => {
    await renderCard();

    fireEvent.click(screen.getByRole('button', { name: /check-in/i }));
    const dateRange = await screen.findByTestId('date-range-mock');

    const minDateText = within(dateRange).getByTestId('min-date-prop').textContent;
    const todayStart = startOfDay(new Date()).toISOString();
    expect(minDateText).toBe(todayStart);

    fireEvent.click(within(dateRange).getByText(/select past dates/i));

    const checkInButton = screen.getByRole('button', { name: /select check-in date/i });
    expect(checkInButton.getAttribute('aria-label')).toContain(format(startOfDay(new Date()), 'dd MMM yyyy'));
  });

  test.each([101, 102, 201])('renders booking widget consistently for listing %s', async (propertyId) => {
    await renderCard(propertyId);
    const property = propertyData.find((p) => p.id === propertyId);
    expect(property).toBeDefined();
    expect(await screen.findByText(/reviews/)).toBeInTheDocument();
    expect(getPrimaryCta()).toBeDisabled();
  });
});
