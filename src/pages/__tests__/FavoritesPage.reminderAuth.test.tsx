import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestAuthContext, type GuestAuthState } from '@/contexts/GuestAuthContext';
import { getTenantSlug, setDomainResolvedSlug } from '@/tenant/tenantResolver';
import FavoritesPage from '../FavoritesPage';

vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/tenant/displayBrand', () => ({ getTenantBrandName: () => 'Test Stays' }));
vi.mock('@/api/listingClient', () => ({
  fetchPublicListings: vi.fn(async () => [{ id: 11, name: 'Garden home', baseNightlyRate: 2400 }]),
}));
vi.mock('@/utils/guestHistory', () => ({
  getFavoriteIds: () => [11], getRecentlyViewed: () => [], toggleFavorite: vi.fn(),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://api.test${path}`,
  getApiHeaders: () => ({ 'X-Tenant-Slug': getTenantSlug() ?? 'test-stays' }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({ useDailyPricingSummary: () => ({ getListingPricing: () => null }) }));
vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ format: (n: number) => `₹${n}`, formatINR: (n: number) => `₹${n}`, isConverted: false }),
}));

const signedIn = (email = 'guest@example.test', guestId = 91): GuestAuthState => ({
  isAuthenticated: true, token: 'fixture-token', email, guestId,
});
const signedOut: GuestAuthState = { isAuthenticated: false, token: null, email: null, guestId: null };
const fetchMock = vi.fn<typeof fetch>();
const posts = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');

function page(auth = signedIn(), isLoading = false) {
  return <MemoryRouter><GuestAuthContext.Provider value={{ auth, isLoading, login: vi.fn(), logout: vi.fn() }}>
    <FavoritesPage />
  </GuestAuthContext.Provider></MemoryRouter>;
}

describe('GUEST-010 saved-home reminder account scope', () => {
  beforeEach(() => {
    localStorage.clear();
    setDomainResolvedSlug('test-stays');
    fetchMock.mockReset().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
  });

  it('prefills the signed-in email despite a different legacy stored address, and sends only on explicit submit', async () => {
    localStorage.setItem('atlas_guest_email', 'previous-account@example.test');
    render(page());
    const input = await screen.findByRole('textbox', { name: 'Reminder email address' });
    expect(input).toHaveValue('guest@example.test');
    expect(posts()).toHaveLength(0);
    fireEvent.submit(input.closest('form')!);
    await screen.findByRole('status');
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ guestEmail: 'guest@example.test', listingId: 11 });
    expect(localStorage.getItem('atlas_guest_email')).toBe('previous-account@example.test');
  });

  it('keeps an edit within the same account and resets it for account, logout, and tenant changes', async () => {
    const view = render(page());
    const input = await screen.findByRole('textbox', { name: 'Reminder email address' });
    fireEvent.change(input, { target: { value: 'travel@example.test' } });
    view.rerender(page({ ...signedIn(), token: 'refreshed-token' }));
    expect(input).toHaveValue('travel@example.test');
    view.rerender(page(signedIn('next@example.test', 92)));
    expect(screen.getByRole('textbox', { name: 'Reminder email address' })).toHaveValue('next@example.test');
    view.rerender(page(signedOut));
    expect(screen.getByRole('textbox', { name: 'Reminder email address' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'anonymous@example.test' } });
    setDomainResolvedSlug('different-stays');
    view.rerender(page(signedOut));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(posts()).toHaveLength(0);
  });

  it('ignores late success from the previous account and clears completed status on logout', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(async (_url, options) => options?.method === 'POST'
      ? new Promise<Response>((resolve) => { finish = resolve; }) : ({ ok: true } as Response));
    const view = render(page());
    const input = await screen.findByRole('textbox', { name: 'Reminder email address' });
    fireEvent.submit(input.closest('form')!);
    fireEvent.submit(input.closest('form')!);
    expect(posts()).toHaveLength(1);
    const signal = posts()[0][1]?.signal;
    view.rerender(page(signedIn('next@example.test', 92)));
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish({ ok: true } as Response); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('next@example.test');
    fetchMock.mockResolvedValue({ ok: true } as Response);
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    await screen.findByRole('status');
    view.rerender(page(signedOut));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(localStorage.getItem('atlas_guest_email')).toBeNull();
  });

  it('waits for native auth hydration, accepts an edited email, and preserves it for a failed retry', async () => {
    const view = render(page(signedOut, true));
    await screen.findByText('Garden home');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    view.rerender(page());
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Travel@Example.test' } });
    fetchMock.mockResolvedValue({ ok: false } as Response);
    fireEvent.submit(input.closest('form')!);
    await screen.findByRole('alert');
    expect(input).toHaveValue('Travel@Example.test');
    expect(screen.getByRole('button', { name: 'Remind me' })).toBeEnabled();
    expect(JSON.parse(posts()[0][1]!.body as string).guestEmail).toBe('travel@example.test');
    fetchMock.mockResolvedValue({ ok: true } as Response);
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('7 days'));
  });
});
