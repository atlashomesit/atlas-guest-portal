import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage_Locations from './HomePage_Locations';
import { settle } from '../../../test/settle';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { clearMarketplaceCardPriceCache } from '../../../hooks/useMarketplaceCardPrices';

const listingsWithGaps = [
  undefined,
  { id: '101', title: 'Room 101' },
  { title: 'No ID' },
] as unknown[];

const trackEventMock = vi.fn();
let navigateMock: ReturnType<typeof vi.fn>;
let mockSearch = '';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/', search: mockSearch, hash: '' }),
    Link: ({ children, to, onClick }: { children: React.ReactNode; to: string | { pathname?: string }; onClick?: () => void }) => (
      <a href={typeof to === 'string' ? to : to.pathname} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

vi.mock('../../../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

describe('HomePage_Locations', () => {
  beforeEach(() => {
    trackEventMock.mockReset();
    navigateMock = vi.fn();
    mockSearch = '';
  });

  it('renders without crashing when listings contain undefined or missing ids', async () => {
    render(
      <MemoryRouter>
        <HomePage_Locations listings={listingsWithGaps} />
      </MemoryRouter>
    );

    // Gap 4b: listing cards now show human display names (SKU→human mapping applied)
    await settle();
    expect(screen.getByText('Studio 101')).toBeInTheDocument();
    await settle();
    expect(trackEventMock).toHaveBeenCalledWith(
      'listings_browse',
      expect.objectContaining({ surface: 'home_locations' }),
      expect.anything(),
    );
  });

  it('emits listings browse analytics with query context', async () => {
    mockSearch = '?checkIn=2025-01-01&guests=2';

    render(
      <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
        <HomePage_Locations listings={listingsWithGaps} />
      </MemoryRouter>
    );

    await settle();
    expect(trackEventMock).toHaveBeenCalledWith(
      'listings_browse',
      expect.objectContaining({
        surface: 'home_locations',
        checkIn: expect.stringContaining('2025-01-01'),
        guests: 2,
      }),
      { route: '/?checkIn=2025-01-01T00%3A00%3A00.000Z&guests=2#our-homes' },
    );
  });

  it('preserves search params when navigating from listing CTAs', async () => {
    mockSearch = '?checkIn=2025-02-01&checkOut=2025-02-05&guests=4';

    render(
      <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
        <HomePage_Locations />
      </MemoryRouter>
    );

    // Guest-home v2: each card is a single tap target with a "See the home" link CTA
    await settle();
    const cta = screen.getAllByText(/see the (home|apartment|room|unit|property)/i);
    fireEvent.click(cta[0]);

    const [navigateArgs] = navigateMock.mock.calls[0] ?? [];
    expect(navigateArgs).toEqual(
      expect.objectContaining({
        pathname: expect.stringMatching(/^\/homes\//),
      }),
    );
    expect(decodeURIComponent(navigateArgs.search)).toContain('checkIn=2025-02-01T00:00:00.000Z');
    expect(decodeURIComponent(navigateArgs.search)).toContain('checkOut=2025-02-05T00:00:00.000Z');
    expect(decodeURIComponent(navigateArgs.search)).toContain('guests=4');

    await settle();
    const selectionEvent = trackEventMock.mock.calls.find(([eventName]) => eventName === 'listing_selected');
    expect(selectionEvent?.[1]).toEqual(
      expect.objectContaining({ surface: 'home_locations', guests: 4 }),
    );
  });

  it('renders stay quote total and nights when dates and guests are in the search query', async () => {
    mockSearch = '?checkIn=2026-10-30&checkOut=2026-11-01&guests=5';
    clearMarketplaceCardPriceCache();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes('/api/pricing/guest-breakdown')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            baseAmount: 10000,
            discountAmount: 2000,
            convenienceFeeAmount: 240,
            finalAmount: 8240,
          }),
        } as Response);
      }
      if (url.includes('/api/pricing/daily-summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            listings: [
              { listingId: 101, baseAmount: 3000, discountAmount: 500, finalAmount: 2500, convenienceFeePercent: 0 },
            ],
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    });

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
          <HomePage_Locations listings={[{ id: '101', title: 'Room 101' }]} />
        </MemoryRouter>
      </CurrencyProvider>
    );

    await settle();

    const quoteCalls = fetchSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/api/pricing/guest-breakdown'));
    expect(quoteCalls.length).toBeGreaterThanOrEqual(1);
    expect(quoteCalls[0]).toContain('checkIn=2026-10-30');
    expect(quoteCalls[0]).toContain('checkOut=2026-11-01');
    expect(quoteCalls[0]).toContain('guests=5');

    // 10,000 / 2 = 5,000 struck standard; (10,000 - 2,000) / 2 = 4,000 real nightly; total 8,000 · 2 nights
    expect(screen.getByTestId('home-card-standard-price')).toHaveTextContent(/5,000/);
    expect(screen.getByTestId('home-card-real-price')).toHaveTextContent(/4,000/);
    expect(screen.getByTestId('home-card-saving')).toHaveTextContent(/20% off/);
    expect(screen.getByTestId('home-card-total')).toHaveTextContent(/8,000 total · 2 nights/);

    fetchSpy.mockRestore();
  });

  it('labels sold out and renders sold-out badge when quote fails for searched dates', async () => {
    mockSearch = '?checkIn=2026-10-30&checkOut=2026-11-01&guests=2';
    clearMarketplaceCardPriceCache();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: unknown) => {
      const url = String(input);
      if (url.includes('/api/pricing/guest-breakdown')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Listing unavailable for selected dates' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    });

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={[{ pathname: '/', search: mockSearch }]}>
          <HomePage_Locations listings={[{ id: '101', title: 'Room 101' }]} />
        </MemoryRouter>
      </CurrencyProvider>
    );

    await settle();

    expect(screen.getByTestId('home-card-sold-out')).toHaveTextContent(/sold out for your dates/i);
    expect(screen.getByTestId('home-card-sold-out-badge')).toHaveTextContent(/sold out/i);

    fetchSpy.mockRestore();
  });
});
