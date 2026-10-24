/**
 * TASK-10299183: BookingBox (UnitBookingWidget) small-party discount hint.
 * When the listing has small-party pricing configured and 1-2 guests are selected,
 * the hint ("Special rate available for 1-2 guests") is displayed.
 * When 3+ guests are selected or small-party pricing is not configured, hint is hidden.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingBox from './BookingBox';
import { BookingProvider } from '@/contexts/BookingContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';

vi.mock('@/runtime-config', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
  getGlobalDiscountPercent: () => 0,
  hasRuntimeConfig: () => true,
  getRuntimeConfig: () => ({ apiBaseUrl: 'https://api.example.com' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: vi.fn(async () => ({
    days: [],
    minStayArrival: {},
  })),
}));

vi.mock('@/api/pricingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/pricingClient')>();
  return {
    ...actual,
    fetchCalendarPricing: vi.fn(async () => ({ listings: [] })),
    fetchPublicListingRatePlans: vi.fn(async () => []),
    fetchGuestPriceBreakdown: vi.fn(async () => null),
  };
});

function renderWidget(props: Partial<React.ComponentProps<typeof BookingBox>> = {}) {
  return render(
    <CurrencyProvider>
      <BookingProvider>
        <MemoryRouter>
          <BookingBox
            listingId={101}
            propertyId={1}
            listingName="Mountain Villa"
            maxGuests={6}
            {...props}
          />
        </MemoryRouter>
      </BookingProvider>
    </CurrencyProvider>,
  );
}

describe('BookingBox small-party discount hint (TASK-10299183)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('renders small-party hint when small-party pricing is configured and guest count is 2', () => {
    renderWidget({ hasSmallPartyPricing: true });
    expect(screen.getByTestId('booking-small-party-hint')).toBeInTheDocument();
    expect(screen.getByTestId('booking-small-party-hint')).toHaveTextContent(
      'Special rate available for 1-2 guests',
    );
  });

  it('does not render small-party hint when hasSmallPartyPricing is false', () => {
    renderWidget({ hasSmallPartyPricing: false });
    expect(screen.queryByTestId('booking-small-party-hint')).not.toBeInTheDocument();
  });

  it('hides the hint when guest count is increased to 3', () => {
    renderWidget({ hasSmallPartyPricing: true });
    expect(screen.getByTestId('booking-small-party-hint')).toBeInTheDocument();

    // Open guests popover and increase to 3
    const trigger = screen.getByLabelText(/Guests: 2 guests/i);
    fireEvent.click(trigger);

    const increaseBtn = screen.getByLabelText('Increase guests');
    fireEvent.click(increaseBtn);

    expect(screen.getByText('3 adults')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-small-party-hint')).not.toBeInTheDocument();
  });

  it('shows custom hint when smallPartyHint prop is provided', () => {
    renderWidget({
      hasSmallPartyPricing: true,
      smallPartyHint: 'Couples & solo discount applies',
    });
    expect(screen.getByTestId('booking-small-party-hint')).toHaveTextContent(
      'Couples & solo discount applies',
    );
  });
});
