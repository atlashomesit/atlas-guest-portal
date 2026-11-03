/**
 * TASK-1451: Search empty state — copy, Clear filters, and "you might also like" suggestions.
 * TASK-7195: a failed *fetch* must render distinctly from a successful *zero-result* search —
 * see the second describe block below.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import { CurrencyProvider } from '../contexts/CurrencyContext';
import SearchPage from '../pages/SearchPage';
import { settle } from '../test/settle';
import { _setTenantContextForTests } from '../tenant/tenantContext';

const mockFetchPublicListings = vi.fn();
vi.mock('../api/listingClient', () => ({
  fetchPublicListings: (...args: unknown[]) => mockFetchPublicListings(...args),
}));

vi.mock('../runtime-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime-config')>();
  return {
    ...actual,
    getApiBaseUrl: () => 'https://api.example.com',
    getGlobalDiscountPercent: () => 0,
  };
});

// TASK-7195: the second describe block below forces the `onlyApiListings` tenant branch, which
// is the one that clears listings to `[]` (rather than falling back to static demo data) when
// the primary fetch fails — the exact combination that used to be indistinguishable from a real
// zero-result search. Everything else from this module (getUnitNoun, allowlist, branding) stays
// real.
//
// Must be `vi.hoisted` (not a plain `let`): SearchPage.tsx's import chain calls
// getTenantOverrides at MODULE-EVAL time (data.ts -> getGuestFacingPhone -> tenantContact), which
// runs before this file's own top-level statements — ES module imports always evaluate before
// the importing module's own body, regardless of source order. A plain `let` here throws
// "Cannot access before initialization"; vi.hoisted lifts the flag above the import evaluation.
const tenantOverridesFlag = vi.hoisted(() => ({ onlyApiListings: false }));
vi.mock('../tenant/tenantOverrides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tenant/tenantOverrides')>();
  return {
    ...actual,
    getTenantOverrides: (slug?: string | null) => ({
      ...actual.getTenantOverrides(slug),
      ...(tenantOverridesFlag.onlyApiListings ? { onlyApiListings: true } : {}),
    }),
  };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('SearchPage — empty state (TASK-1451)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
    mockFetchPublicListings.mockReset();
    // TASK-7195: a SUCCESSFUL, non-empty catalog filtered to zero by minPrice — not a rejected
    // fetch. The two are no longer interchangeable: only a successful response licenses "No ...
    // match your filters", and the catalog must stay non-empty here (real listings, all priced
    // below the filter) so the "you might also like" suggestions pool — sourced from `listings`
    // pre-filter — still has something to suggest, same as this test always intended.
    mockFetchPublicListings.mockResolvedValue([
      { id: 101, name: 'Palm Grove 1BHK', maxGuests: 2, baseNightlyRate: 3000 },
      { id: 102, name: 'Palm Grove 2BHK', maxGuests: 4, baseNightlyRate: 4500 },
      { id: 103, name: 'Sea View Studio', maxGuests: 2, baseNightlyRate: 2800 },
    ]);
  });

  it('shows empty copy, Clear filters, suggestions; clearing restores results', async () => {
    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search?minPrice=999999999']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await settle();
    expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'No stays are available for this search' })).toBeInTheDocument();
    expect(screen.getByText(/try adjusting dates, price range, or guest count/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-empty-clear-filters')).toBeInTheDocument();
    expect(screen.getByTestId('search-empty-suggestions')).toBeInTheDocument();
    expect(screen.getAllByTestId('search-empty-suggestion-card')).toHaveLength(3);
    expect(screen.queryByTestId('search-load-error')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-empty-clear-filters'));

    await settle();
    expect(screen.getByTestId('guest-search-results')).toBeInTheDocument();
    expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
  });
});

describe('SearchPage — load failure must not claim zero results (TASK-7195)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(new Promise(() => {}));
    mockFetchPublicListings.mockReset();
    // Forces the branch that clears listings to `[]` on a failed fetch instead of falling back
    // to static demo data (see the `listings` memo / loadFromApi's catch in SearchPage.tsx) —
    // the exact combination that used to be indistinguishable from a real zero-result search.
    tenantOverridesFlag.onlyApiListings = true;
  });

  afterEach(() => {
    tenantOverridesFlag.onlyApiListings = false;
  });

  it('a rejected listings fetch shows a retryable error, never "No ... match your filters"', async () => {
    mockFetchPublicListings.mockRejectedValue(new Error('network down'));

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await settle();
    expect(screen.getByTestId('search-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /no homestays match your filters/i })).not.toBeInTheDocument();
  });

  it('a successful empty response (same onlyApiListings branch) DOES show "No ... match your filters"', async () => {
    mockFetchPublicListings.mockResolvedValue([]);

    render(
      <CurrencyProvider>
        <MemoryRouter initialEntries={['/search']}>
          <SearchPage />
        </MemoryRouter>
      </CurrencyProvider>,
    );

    await settle();
    expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('search-load-error')).not.toBeInTheDocument();
  });
});

function SearchLocation() {
  return <output data-testid="search-location">{useLocation().search}</output>;
}

describe('UX-2026-11-03-06: tenant search recovery', () => {
  beforeEach(() => {
    tenantOverridesFlag.onlyApiListings = true;
    _setTenantContextForTests({ name: 'Fixture tenant', slug: 'weekly-fixture', guestCommsBrandingMode: 'Neutral', legalContactPack: { displayName: 'Fixture Stays', contactPhone: '+910000000099', isCustomDomain: true } });
    mockFetchPublicListings.mockReset();
    mockFetchPublicListings.mockResolvedValue([]);
    mockFetch.mockReset();
    mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ availableListingIds: [] }) }));
  });
  afterEach(() => {
    tenantOverridesFlag.onlyApiListings = false;
    _setTenantContextForTests(null);
  });
  const renderRecovery = () => render(<CurrencyProvider><MemoryRouter initialEntries={['/search?checkIn=2026-11-10&checkOut=2026-11-12&guests=3&adults=2&children=1&amenities=wifi&minPrice=1000']}><SearchPage /><SearchLocation /></MemoryRouter></CurrencyProvider>);

  it('focuses the existing date field, retains date/party scope while clearing optional filters and offers the tenant contact', async () => {
    renderRecovery();
    await settle();
    const scrollIntoView = vi.fn();
    screen.getByLabelText('Check-in').scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByTestId('search-empty-change-dates'));
    expect(screen.getByLabelText('Check-in')).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(screen.getByRole('link', { name: /Call Fixture Stays/ })).toHaveAttribute('href', 'tel:+910000000099');
    fireEvent.click(screen.getByTestId('search-empty-clear-filters'));
    await settle();
    const params = new URLSearchParams(screen.getByTestId('search-location').textContent ?? '');
    expect(params.get('checkIn')).toBe('2026-11-10');
    expect(params.get('checkOut')).toBe('2026-11-12');
    expect(params.get('guests')).toBe('3');
    expect(params.get('adults')).toBe('2');
    expect(params.get('children')).toBe('1');
    expect(params.has('amenities')).toBe(false);
    expect(params.has('minPrice')).toBe(false);
    expect(screen.getByLabelText('Guests')).toHaveValue(3);
    expect(screen.getByTestId('search-empty-browse-all')).toHaveAttribute('href', '/search');
  });

  it('does not claim empty success while date availability is still loading', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderRecovery();
    await settle();
    expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('search-date-availability-skeleton').length).toBeGreaterThan(0);
  });

  it('keeps failed availability distinct from a successful empty search', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderRecovery();
    await settle();
    expect(screen.getByTestId('search-date-availability-failed')).toBeInTheDocument();
    expect(screen.queryByTestId('search-empty-state')).not.toBeInTheDocument();
  });
});
