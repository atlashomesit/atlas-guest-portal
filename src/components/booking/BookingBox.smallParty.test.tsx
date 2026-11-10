/**
 * TASK-10299183: BookingBox (UnitBookingWidget) small-party discount hint.
 * When the listing has small-party pricing configured and 1-2 guests are selected,
 * the hint ("Special rate available for 1-2 guests") is displayed.
 * When 3+ guests are selected or small-party pricing is not configured, hint is hidden.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle } from '../../test/settle';
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
  // The real client resolves a Response (the widget reads .json() from it), as UnitBookingWidget.pricingRetry.test.tsx mocks it.
  dedupedAvailabilityCalendarFetch: vi.fn(
    async () => new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
  ),
}));

vi.mock('@/api/pricingClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/pricingClient')>();
  return {
    ...actual,
    fetchCalendarPricing: vi.fn(async () => ({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 0 })),
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

// HEALTH-1110: the widget starts its price reads on mount. The tests ended before those resolved (React logged "not wrapped in act(...)"
// 45 times per run) and the mocks had the wrong shapes, which only showed once the reads were drained. mount() drains them inside act.
async function mount(props: Partial<React.ComponentProps<typeof BookingBox>> = {}) {
  const view = renderWidget(props);
  await settle();
  return view;
}

describe('BookingBox small-party discount hint (TASK-10299183)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A fresh Response per call: one shared object can be read only once ("Body is unusable").
    mockFetch.mockImplementation(
      async () => new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('renders small-party hint when small-party pricing is configured and guest count is 2', async () => {
    await mount({ hasSmallPartyPricing: true });
    expect(screen.getByTestId('booking-small-party-hint')).toBeInTheDocument();
    expect(screen.getByTestId('booking-small-party-hint')).toHaveTextContent(
      'Special rate available for 1-2 guests',
    );
  });

  it('does not render small-party hint when hasSmallPartyPricing is false', async () => {
    await mount({ hasSmallPartyPricing: false });
    expect(screen.queryByTestId('booking-small-party-hint')).not.toBeInTheDocument();
  });

  it('hides the hint when guest count is increased to 3', async () => {
    await mount({ hasSmallPartyPricing: true });
    expect(screen.getByTestId('booking-small-party-hint')).toBeInTheDocument();

    // Open guests popover and increase to 3
    const trigger = screen.getByRole('button', { name: /^Guests[ ]*2 adults/i });
    fireEvent.click(trigger);

    const increaseBtn = screen.getByLabelText('Increase guests');
    fireEvent.click(increaseBtn);
    await settle();

    expect(screen.getByText('3 adults')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-small-party-hint')).not.toBeInTheDocument();
  });

  it('shows custom hint when smallPartyHint prop is provided', async () => {
    await mount({
      hasSmallPartyPricing: true,
      smallPartyHint: 'Couples & solo discount applies',
    });
    expect(screen.getByTestId('booking-small-party-hint')).toHaveTextContent(
      'Couples & solo discount applies',
    );
  });
});
