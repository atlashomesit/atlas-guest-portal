/**
 * PRICE-024 (PRICE-016 leftover): a guest who arrives through a travel agent's link (?agent=CODE)
 *  - has the code taken out of the address bar at page load and remembered for the tab,
 *  - gets the agent's rate list from the API (the code is sent as agentCode),
 *  - lands on the agent's rate already selected, with the "Special rate from <agent>" badge,
 *  - and never sees the code on the page. An ordinary guest keeps the default plan and no badge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { addDays, nextFriday } from 'date-fns';
import { toISODate } from '@/utils/dateRange';
import { getIstStartOfDay } from '@/utils/date';
import { clearAgentCode, getAgentCode, rememberAgentCodeFromLink } from '@/lib/agentCode';
import { settle } from '../../test/settle';

const CODE = 'SUNRISE-NET-01';

const mocks = vi.hoisted(() => ({
  fetchCalendarPricing: vi.fn(),
  fetchGuestGstBreakdown: vi.fn(),
  fetchGuestPriceBreakdown: vi.fn(),
  booking: { checkIn: null as string | null, checkOut: null as string | null, guests: 2 },
}));

vi.mock('@/runtime-config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasRuntimeConfig: () => true,
}));
vi.mock('@/tenant/tenantContext', () => ({
  getTenantContext: () => ({ slug: 'atlas', name: 'Atlastays', paymentProvider: 'RAZORPAY', bookingMode: 'ONLINE' }),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
  getOrderRequestHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: async () =>
    new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
}));
// The REAL fetchPublicListingRatePlans runs (it reads the remembered code); everything else the widget fetches is mocked.
vi.mock('@/api/pricingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCalendarPricing: mocks.fetchCalendarPricing,
  fetchGuestGstBreakdown: mocks.fetchGuestGstBreakdown,
  fetchGuestPriceBreakdown: mocks.fetchGuestPriceBreakdown,
}));
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchPublicListings: async () => [],
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: mocks.booking, updateBooking: vi.fn() }),
}));
vi.mock('@/contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({ getUrlsForListingId: () => undefined }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({
  useDailyPricingSummary: () => ({
    data: null,
    loading: false,
    error: null,
    getListingPricing: () => ({ baseAmount: 6000, actualPrice: 6000, globalDiscountPercent: 0 }),
  }),
}));
vi.mock('@/components/FomoBar', () => ({ default: () => null }));
vi.mock('@/lib/events', () => ({ track: vi.fn() }));
vi.mock('./AtlasBookingCalendar', () => ({ AtlasBookingCalendar: () => null }));

const plan = (extra: Record<string, unknown>) => ({
  listingId: 7, sortOrder: 0, guests: 2, isDefault: false,
  baseNightlyRate: 6000, effectiveNightlyRate: 6000, totalStayAmount: 12000,
  cancellationPolicy: 'Flexible', cancellationSummary: 'Free cancellation up to 24 hours before check-in',
  mealPlanCode: 'EP', mealPlanLabel: 'Room Only', isDerived: false, ...extra,
});

const standardPlan = plan({ id: 11, name: 'Standard', isDefault: true });
const agentPlan = plan({
  id: 12, name: 'Sunrise net', sortOrder: 1, baseNightlyRate: 3000, effectiveNightlyRate: 3000, totalStayAmount: 6000,
  isAgentRate: true, agentName: 'Sunrise Travels', mealPlanCode: 'CP', mealPlanLabel: 'Breakfast Included',
});

const requestedUrls: string[] = [];

function stubPlansEndpoint(body: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    requestedUrls.push(url);
    return new Response(JSON.stringify(url.includes('/rate-plans/public') ? body : []), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }));
}

async function renderWidget() {
  const checkIn = getIstStartOfDay(nextFriday(addDays(new Date(), 7)));
  mocks.fetchCalendarPricing.mockResolvedValue({ dateToPrice: new Map<string, number>(), convenienceFeePercent: 0 });
  mocks.fetchGuestGstBreakdown.mockResolvedValue(null);
  mocks.fetchGuestPriceBreakdown.mockResolvedValue(null);
  mocks.booking.checkIn = toISODate(checkIn);
  mocks.booking.checkOut = toISODate(addDays(checkIn, 2));
  const { default: UnitBookingWidget } = await import('./UnitBookingWidget');
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <MemoryRouter>
        <UnitBookingWidget listingId={7} propertyId={3} listingName="Atlas 302" propertySlug="atlas302" unitSlug="u302" />
      </MemoryRouter>,
    );
  });
  await settle();
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  requestedUrls.length = 0;
  clearAgentCode();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearAgentCode();
  window.history.replaceState({}, '', '/');
  mocks.booking.checkIn = null;
  mocks.booking.checkOut = null;
});

describe('UnitBookingWidget - PRICE-024: the agent link (?agent=CODE)', () => {
  it('takes the code out of the address bar at page load, keeps every other parameter, and remembers it for the tab', () => {
    window.history.replaceState({}, '', `/stay/atlas302?guests=2&agent=${CODE.toLowerCase()}#book`);

    expect(rememberAgentCodeFromLink()).toBe(true);

    expect(window.location.search).toBe('?guests=2');
    expect(window.location.hash).toBe('#book');
    expect(window.location.href.toUpperCase()).not.toContain(CODE);
    expect(getAgentCode()).toBe(CODE);
  });

  it('does nothing for an ordinary link', () => {
    window.history.replaceState({}, '', '/stay/atlas302?guests=2');
    expect(rememberAgentCodeFromLink()).toBe(false);
    expect(window.location.search).toBe('?guests=2');
    expect(getAgentCode()).toBeNull();
  });

  it('sends the code with the rate-plan request, preselects the agent rate and shows the "Special rate from" badge, and never prints the code', async () => {
    window.history.replaceState({}, '', `/stay/atlas302?agent=${CODE}`);
    rememberAgentCodeFromLink();
    stubPlansEndpoint([standardPlan, agentPlan]);

    const { container } = await renderWidget();

    const planRequest = requestedUrls.find((u) => u.includes('/rate-plans/public'));
    expect(planRequest).toBeDefined();
    expect(planRequest).toContain(`agentCode=${CODE}`);

    expect(screen.getByTestId('bw-rate-plan-option-12')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('bw-rate-plan-option-11')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('rate-plan-agent-badge-12').textContent).toBe('Special rate from Sunrise Travels');

    expect(container.textContent ?? '').not.toContain(CODE);
    expect(window.location.href.toUpperCase()).not.toContain(CODE);
  });

  it('an ordinary guest starts on the main plan and sees no agent badge', async () => {
    stubPlansEndpoint([standardPlan, plan({ id: 13, name: 'Breakfast', sortOrder: 1, mealPlanCode: 'CP', mealPlanLabel: 'Breakfast Included' })]);

    await renderWidget();

    expect(requestedUrls.find((u) => u.includes('/rate-plans/public'))).not.toContain('agentCode');
    expect(screen.getByTestId('bw-rate-plan-option-11')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('rate-plan-agent-badge-12')).toBeNull();
  });
});
