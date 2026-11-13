/**
 * GUEST-065 — a home card with no dates picked shows tonight's price. A home that is SOLD tonight must not say
 * "/ night tonight": it says it is booked, when it is next open, and where to see a price. No number is shown
 * for a night the guest cannot book. A home open tonight, or a failed availability ask, keeps the old card.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage_Locations from './HomePage_Locations';
import { settle } from '../../../test/settle';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { invalidateDailyPricingCache } from '../../../hooks/useDailyPricingSummary';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
    Link: ({ children, to, onClick }: { children: React.ReactNode; to: string | { pathname?: string }; onClick?: () => void }) => (
      <a href={typeof to === 'string' ? to : to.pathname} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

vi.mock('../../../utils/analytics', () => ({ trackEvent: vi.fn() }));

type SummaryRow = { listingId: number; isAvailableTonight: boolean; nextAvailableDate?: string | null; percentBookedNext30Days?: number };

function stubFetch(availability: SummaryRow[] | 'fail') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: unknown) => {
    const url = String(input);
    if (url.includes('/availability/summary')) {
      if (availability === 'fail') return Promise.reject(new Error('Network Error'));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => availability.map((r) => ({ percentBookedNext30Days: 0, ...r })),
      } as Response);
    }
    if (url.includes('/api/pricing/daily-summary')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          date: '2026-11-09',
          listings: [{ listingId: 101, baseAmount: 3328, discountAmount: 832, finalAmount: 2496, convenienceFeePercent: 0 }],
        }),
      } as Response);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
  });
}

function renderCards() {
  return render(
    <CurrencyProvider>
      <MemoryRouter>
        <HomePage_Locations listings={[{ id: '101', title: 'Room 101' }]} />
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe('HomePage_Locations — sold tonight (GUEST-065)', () => {
  beforeEach(() => {
    invalidateDailyPricingCache();
  });

  it('a home sold tonight says so, names the next open night, and shows no "tonight" price', async () => {
    const spy = stubFetch([{ listingId: 101, isAvailableTonight: false, nextAvailableDate: '2026-11-12' }]);
    renderCards();
    await settle();

    expect(screen.getByTestId('home-card-sold-tonight')).toHaveTextContent('Booked tonight');
    expect(screen.getByTestId('home-card-sold-tonight-hint')).toHaveTextContent('Next open night: 12 Nov. Pick your dates to see the price.');
    expect(screen.queryByTestId('home-card-night-label')).toBeNull();
    expect(screen.queryByTestId('home-card-real-price')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/night tonight/);
    spy.mockRestore();
  });

  it('names the next open night when the API sends it as a UTC timestamp, which is how it really sends it', async () => {
    // Real answer of GET /availability/summary (seen on a local stack 2026-11-09): "2026-11-11T00:00:00.0000000Z", not a bare date.
    const spy = stubFetch([{ listingId: 101, isAvailableTonight: false, nextAvailableDate: '2026-11-11T00:00:00.0000000Z' }]);
    renderCards();
    await settle();
    expect(screen.getByTestId('home-card-sold-tonight-hint')).toHaveTextContent('Next open night: 11 Nov. Pick your dates to see the price.');
    spy.mockRestore();
  });

  it('a home sold tonight with no known open night still says one clear thing', async () => {
    const spy = stubFetch([{ listingId: 101, isAvailableTonight: false, nextAvailableDate: null }]);
    renderCards();
    await settle();
    expect(screen.getByTestId('home-card-sold-tonight-hint')).toHaveTextContent(/^Pick your dates to see the price\.$/);
    spy.mockRestore();
  });

  it('a home open tonight keeps tonight\'s price and the tonight label', async () => {
    const spy = stubFetch([{ listingId: 101, isAvailableTonight: true, nextAvailableDate: null }]);
    renderCards();
    await settle();
    expect(screen.queryByTestId('home-card-sold-tonight')).toBeNull();
    expect(screen.getByTestId('home-card-night-label')).toHaveTextContent('/ night tonight');
    expect(screen.getByTestId('home-card-real-price')).toHaveTextContent(/2,496/);
    spy.mockRestore();
  });

  it('when tonight\'s availability cannot be read, the card stays exactly as it was', async () => {
    const spy = stubFetch('fail');
    renderCards();
    await settle();
    expect(screen.queryByTestId('home-card-sold-tonight')).toBeNull();
    expect(screen.getByTestId('home-card-night-label')).toHaveTextContent('/ night tonight');
    expect(screen.getByTestId('home-card-real-price')).toHaveTextContent(/2,496/);
    spy.mockRestore();
  });
});
