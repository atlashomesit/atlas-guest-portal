// TASK-101960 — marketplace home served no canonical link and no og:site_name, so the
// TASK-101940 brand arm (tests/og-seo-brand-isolation.e2e.spec.ts:367, expects canonical
// non-empty + Atlas host check) fails.
//
// These tests render the REAL <SEO> (deliberately NOT mocked, unlike
// MarketplaceHomepagePagination.test.tsx) and pin both head tags:
//   1. a self-referencing ABSOLUTE canonical link (mirrors Home.tsx's
//      getPublicSiteOrigin() pattern — window.location.origin + "/").
//   2. og:site_name pinned to the shipped brand baseline (MARKETPLACE_BRAND_BASELINE).
//
// RED before the fix: canonical stays "" (SEO's no-`url` fallback) and no
// meta[property='og:site_name'] exists in <head> at all.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client', () => ({ buildApiUrl: (p: string) => `https://api.test${p}` }));
vi.mock('@/components/map/MultiPinMap', () => ({ default: () => null }));
vi.mock('@/components/marketplace/airbnbSearch/AirbnbSearchBar', () => ({ default: () => null }));
vi.mock('@/components/ReviewSummary', () => ({ default: () => null }));
vi.mock('@/components/OwnerShareBadge', () => ({ default: () => null }));
vi.mock('@/components/ui/OptimizedImage', () => ({ default: () => null }));
vi.mock('@/components/apartments/SkeletonCard', () => ({ default: () => null }));
vi.mock('@/utils/guestHistory', () => ({ getFavoriteIds: () => [], toggleFavorite: () => {} }));
vi.mock('@/tenant/paymentRail', () => ({ hasOnlinePaymentRail: () => false }));
vi.mock('@/utils/marketplaceListingCover', () => ({
  enrichMarketplaceCoverItems: async <T,>(items: T[]) => items,
}));

import MarketplaceHomepage from './MarketplaceHomepage';
import { MARKETPLACE_BRAND_BASELINE } from '@/tenant/displayBrand';

function clearHeadTags() {
  document.head.querySelector("link[rel='canonical']")?.remove();
  document.head.querySelector("link[rel=\"canonical\"]")?.remove();
  document.head.querySelector("meta[property='og:site_name']")?.remove();
  document.head.querySelector('meta[property="og:site_name"]')?.remove();
  document.head.querySelector("meta[property='og:url']")?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
}

beforeEach(() => {
  clearHeadTags();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/marketplace/properties')) {
        return { ok: true, json: async () => [] } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  clearHeadTags();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <MarketplaceHomepage />
    </MemoryRouter>,
  );

describe('TASK-101960 marketplace homepage canonical + og:site_name', () => {
  it('serves a self-referencing absolute canonical link', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('marketplace-homepage')).toBeInTheDocument());
    // SEO writes head tags in useEffect — wait for the canonical to land.
    // NOTE: assert on getAttribute("href"), not the `.href` DOM property — an empty
    // attribute still resolves via the document base URL, which would mask the bug.
    await waitFor(() => {
      const canonical = document.head.querySelector(
        "link[rel='canonical'], link[rel=\"canonical\"]",
      ) as HTMLLinkElement | null;
      expect(canonical?.getAttribute('href')).toBeTruthy();
    });
    const canonical = document.head.querySelector(
      "link[rel='canonical'], link[rel=\"canonical\"]",
    ) as HTMLLinkElement | null;
    // Absolute (not "") and self-referencing the marketplace root on this host.
    expect(canonical!.getAttribute('href')).toBe(`${window.location.origin}/`);
  });

  it('serves og:site_name pinned to the shipped brand baseline', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('marketplace-homepage')).toBeInTheDocument());
    await waitFor(() => {
      const siteName = document.head.querySelector(
        "meta[property='og:site_name'], meta[property=\"og:site_name\"]",
      ) as HTMLMetaElement | null;
      expect(siteName?.content).toBeTruthy();
    });
    const siteName = document.head.querySelector(
      "meta[property='og:site_name'], meta[property=\"og:site_name\"]",
    ) as HTMLMetaElement | null;
    expect(siteName!.content).toBe(MARKETPLACE_BRAND_BASELINE);
    expect(siteName!.content).toBe('Atlastays');
  });
});
