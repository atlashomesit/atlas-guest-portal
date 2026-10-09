import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense } from 'react';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';
import { resolveEffectiveListingAddress } from '../../../utils/listingAddress';
import { settle } from '../../../test/settle';
import { _setTenantContextForTests, _resetTenantContextForTests } from '@/tenant/tenantContext';

vi.mock('@/components/availability/UnitBookingWidget', () => ({
  __esModule: true,
  default: () => <div>Booking Widget</div>,
}));

vi.mock('@/components/AvailabilityCalendar', () => ({
  __esModule: true,
  default: () => <div>Availability Calendar</div>,
}));

vi.mock('@/components/GuestAssistant', () => ({
  __esModule: true,
  default: () => <div>Guest Assistant</div>,
}));

vi.mock('@/components/homepage_components/hotelBooking_form/BookingCard.tsx', () => ({
  __esModule: true,
  default: () => <div id="booking-form">Booking Form</div>,
}));

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => 'test-unit'),
}));

vi.mock('@/config/policyConfig', () => ({
  getUnitPolicy: () => ({ checkIn: '2:00 PM', checkOut: '11:00 AM' }),
}));

vi.mock('@/content/terms', () => ({
  inlinePolicySnippets: { cancellation: 'Flexible cancellation', houseRules: 'Be kind' },
}));

vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({
    booking: { propertyId: null, checkIn: null, checkOut: null, guests: 2 },
    setProperty: vi.fn(),
    setPendingScrollTarget: vi.fn(),
    updateBooking: vi.fn(),
    setDates: vi.fn(),
    setGuests: vi.fn(),
    pendingScrollTarget: null,
  }),
  BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@fancyapps/ui', () => ({
  Fancybox: {
    bind: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
  },
}));

const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
  resolveEffectiveListingAddress: (source: unknown) => resolveEffectiveListingAddress(source),
  normalizeListingPayload: vi.fn((raw) => raw),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

const readJsonLd = (): Record<string, unknown>[] => {
  const script = document.head.querySelector('script[data-seo-json-ld]');
  expect(script?.textContent).toBeTruthy();
  return JSON.parse(script!.textContent!);
};

describe('Homepage_PropertyDetails listing JSON-LD (TASK-102732 item 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTenantContextForTests();
    document.head.querySelector('script[data-seo-json-ld]')?.remove();
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 101,
          listingId: 101,
          property_name: 'Atlas101',
          property_location: '165, KPHB 7th Phase',
          property_img: ['https://cdn.example.com/img1.jpg'],
          property_amenities: [],
          property_description: '',
          property_rating: 4.9,
          property_reviews: 10,
          property_price: 2500,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });
  });

  it('uses the guest-facing display name, not the raw SKU', async () => {
    render(
      <MemoryRouter initialEntries={['/homes/atlas101/101']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await settle();
    const nodes = readJsonLd();
    const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness');
    expect(lodging).toBeDefined();
    expect(lodging!['name']).toBe('Studio 101');
  });

  it('omits an empty description and puts the street in streetAddress', async () => {
    render(
      <MemoryRouter initialEntries={['/homes/atlas101/101']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await settle();
    const nodes = readJsonLd();
    const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness') as Record<string, unknown>;
    expect('description' in lodging).toBe(false);
    const address = lodging['address'] as Record<string, unknown>;
    expect(address['streetAddress']).toBe('165, KPHB 7th Phase');
    expect('addressLocality' in address).toBe(false);
    expect('addressRegion' in address).toBe(false);
    expect(address['addressRegion']).toBeUndefined();
    expect(address['addressCountry']).toBe('IN');
  });

  it('GUEST-013: outputs addressRegion: "Goa" and addressLocality: "Calangute" when present and does not default to Telangana when missing', async () => {
    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 202,
          listingId: 202,
          property_name: 'GoaVilla',
          property_location: 'Near Calangute Beach',
          city: 'Calangute',
          state: 'Goa',
          country: 'IN',
          property_img: ['https://cdn.example.com/goa.jpg'],
          property_amenities: [],
          property_description: 'Cozy villa near the beach',
          property_rating: 4.8,
          property_reviews: 5,
          property_price: 5000,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/homes/goavilla/202']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await settle();
    const nodes = readJsonLd();
    const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness') as Record<string, unknown>;
    expect(lodging).toBeDefined();
    const address = lodging['address'] as Record<string, unknown>;
    expect(address).toBeDefined();
    expect(address['addressLocality']).toBe('Calangute');
    expect(address['addressRegion']).toBe('Goa');
    expect(address['addressCountry']).toBe('IN');
    expect(address['streetAddress']).toBe('Near Calangute Beach');
  });

  it('GUEST-013: falls back to tenant legalContactPack state when listing state is missing', async () => {
    _setTenantContextForTests({
      name: 'Kerala Homestay',
      slug: 'kerala-homestay',
      legalContactPack: {
        state: 'Kerala',
        city: 'Kochi',
        showAtlasFooterCredit: false,
        isCustomDomain: false,
      },
    });

    mockUseTenantListings.mockReturnValue({
      listings: [],
      properties: [
        {
          id: 303,
          listingId: 303,
          property_name: 'KeralaHome',
          property_location: 'Fort Kochi Road',
          property_img: ['https://cdn.example.com/kerala.jpg'],
          property_amenities: [],
          property_description: '',
          property_rating: 4.9,
          property_reviews: 8,
          property_price: 3500,
        },
      ],
      state: 'success',
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/homes/keralahome/303']}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );

    await settle();
    const nodes = readJsonLd();
    const lodging = nodes.find((n) => n['@type'] === 'LodgingBusiness') as Record<string, unknown>;
    const address = lodging['address'] as Record<string, unknown>;
    expect(address['addressRegion']).toBe('Kerala');
    expect('addressLocality' in address).toBe(false);
  });
});

