import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestAuthContext, type GuestAuthState } from '@/contexts/GuestAuthContext';
import { getTenantSlug, setDomainResolvedSlug } from '@/tenant/tenantResolver';
import FavoritesPage from '../FavoritesPage';
import { settle } from '../../test/settle';

vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/tenant/displayBrand', () => ({ getTenantBrandName: () => 'Test Stays' }));
vi.mock('@/api/listingClient', () => ({
  fetchPublicListings: vi.fn(async () => [{ id: 11, name: 'Garden home', baseNightlyRate: 2400 }]),
}));
vi.mock('@/utils/guestHistory', () => ({
  getFavoriteIds: () => localIds, getRecentlyViewed: () => [], toggleFavorite: vi.fn(),
}));
vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://api.test${path}`,
  getApiHeaders: () => ({ 'X-Tenant-Slug': getTenantSlug() ?? 'test-stays' }),
}));
vi.mock('@/hooks/useDailyPricingSummary', () => ({ useDailyPricingSummary: () => ({ getListingPricing: () => null }) }));
vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ format: (n: number) => `₹${n}`, formatINR: (n: number) => `₹${n}`, isConverted: false }),
}));


let localIds: number[] = [22];
const signedOut: GuestAuthState = { isAuthenticated: false, token: null, email: null, guestId: null };
function page(path: string) {
  return <MemoryRouter initialEntries={[path]}><GuestAuthContext.Provider value={{ auth: signedOut, isLoading: false, login: vi.fn(), logout: vi.fn() }}><FavoritesPage /></GuestAuthContext.Provider></MemoryRouter>;
}
describe('approved wishlist share source', () => {
  beforeEach(() => {
    localIds = [22]; setDomainResolvedSlug('test-stays');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it.each([[[22]], [[]]])('shares received IDs with local saves %s', async (ids) => {
    localIds = ids as number[];
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(page('/favorites?wishlist=MTE%3D&brand=atlastays&untrusted=discard'));
    await settle(); fireEvent.click(screen.getByRole('button', { name: 'Share this wishlist' }));
    const url = new URL(share.mock.calls[0][0].url);
    expect(atob(url.searchParams.get('wishlist')!)).toBe('11');
    expect(url.searchParams.get('brand')).toBe('atlastays');
    expect(url.searchParams.get('tenant')).toBe('test-stays');
    expect(url.searchParams.has('untrusted')).toBe(false);
    expect(localIds).toEqual(ids);
    expect(screen.queryByRole('button', { name: 'Remove from saved' })).not.toBeInTheDocument();
  });
  it('shares own local IDs and retains remove actions', async () => {
    localIds = [11]; const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(page('/favorites')); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Share wishlist' }));
    expect(atob(new URL(share.mock.calls[0][0].url).searchParams.get('wishlist')!)).toBe('11');
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
  });
  it('copies received IDs and falls back to WhatsApp if clipboard rejects', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(page('/favorites?wishlist=MTE%3D')); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Share this wishlist' })); await settle();
    expect(atob(new URL(copy.mock.calls[0][0]).searchParams.get('wishlist')!)).toBe('11');
    expect(screen.getByRole('button', { name: /Link copied/ })).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });
  it('uses WhatsApp if clipboard is unavailable without mutating saves', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(page('/favorites?wishlist=MTE%3D')); await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Share this wishlist' })); await settle();
    const message = new URL(open.mock.calls[0][0] as string).searchParams.get('text')!;
    expect(message).toContain('wishlist=MTE%3D'); expect(localIds).toEqual([22]);
  });
});
