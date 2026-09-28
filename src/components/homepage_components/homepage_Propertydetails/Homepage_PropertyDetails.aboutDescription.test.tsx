/**
 * "About this home" must show the description the host entered in the admin portal under
 * Rooms & prices → Listing details (Full description, else Short description).
 *
 * Prior state (the defect): the section read `property_description`, which the list row fills from
 * SEO/meta fields the guest client never carries, so every listing showed "The host hasn't added a
 * description yet" even when the host had written one. The text lives only on GET /listings/{id}
 * (`longDescription` / `shortDescription`).
 *
 * The heritage layout carries an identical copy of this section — see
 * src/themes/heritage/PropertyDetails.aboutDescription.test.tsx (kept in a separate file: rendering
 * both layouts in one run exhausts the worker heap, see ac7-layout-theme-switch.test.tsx).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Suspense } from 'react';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';

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
vi.mock('@/utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 1000 })),
  inferUnitType: vi.fn(() => 'test-unit'),
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
  Fancybox: { bind: vi.fn(), destroy: vi.fn(), show: vi.fn() },
}));
// A guest-facing phone makes the "Ask them about this home" WhatsApp empty state reachable.
vi.mock('@/config/contact', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/contact')>()),
  getGuestFacingPhone: () => '9876543210',
}));

const mockFetchListingById = vi.fn();
vi.mock('@/api/listingClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/listingClient')>()),
  fetchListingById: (...args: unknown[]) => mockFetchListingById(...args),
}));

const mockResolveListing = vi.fn();
vi.mock('@/utils/listingResolver', () => ({
  resolveListing: (...args: unknown[]) => mockResolveListing(...args),
}));

const mockUseTenantListings = vi.fn();
vi.mock('@/hooks/useTenantListings', () => ({
  useTenantListings: () => mockUseTenantListings(),
}));

const FULL_DESCRIPTION = [
  'A beautifully furnished 2BHK in Bangalore with a heritage-inspired, warm and luxurious feel. Enjoy a private open terrace, fully equipped kitchen, projector with recliners, home library and board games.',
  '',
  '✨ Highlights',
  '',
  '🏡 Entire private 2BHK',
  '🌿 Open terrace with outdoor seating',
  '🎬 Projector + comfortable recliners',
  '📚 Extensive home library',
].join('\n');

/** The list row exactly as production produces it for this listing: no description. */
const LIST_ROW = {
  id: 637,
  listingId: 637,
  propertyName: 'Azure Villa',
  property_name: 'Azure Villa',
  property_location: 'Goa',
  property_img: ['https://cdn.example.com/img1.jpg'],
  property_amenities: [],
  property_description: '',
  property_rating: 0,
  property_reviews: 0,
  checkInTime: '14:00',
  checkOutTime: '11:00',
};

const listState = (properties: unknown[]) => ({ listings: [], properties, state: 'success', refetch: vi.fn() });

const page = () => (
  <MemoryRouter initialEntries={['/homes/azure-villa/637']}>
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/homes/:propertySlug/:unitSlug" element={<Homepage_PropertyDetails />} />
      </Routes>
    </Suspense>
  </MemoryRouter>
);

describe('Listing page "About this home" shows the host description from Rooms & prices → Listing details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenantListings.mockReturnValue(listState([LIST_ROW]));
    mockResolveListing.mockResolvedValue({ id: 637, propertyId: 12, name: 'Azure Villa', propertyName: 'Azure Villa' });
  });

  it('renders the Full description with its line breaks instead of the "hasn\'t added a description" state', async () => {
    mockFetchListingById.mockResolvedValue({ id: 637, longDescription: FULL_DESCRIPTION, shortDescription: 'Short copy' });

    render(page());

    const about = await screen.findByTestId('property-about-description');
    expect(about.className).toContain('whitespace-pre-wrap');
    expect(about.textContent).toContain('\n\n✨ Highlights\n\n🏡 Entire private 2BHK');
    expect(about.textContent).toMatch(/…$/);
    expect(screen.queryByTestId('property-about-ask-host')).not.toBeInTheDocument();
    expect(mockFetchListingById).toHaveBeenCalledWith(637, expect.anything());

    fireEvent.click(screen.getByRole('button', { name: /read more/i }));
    expect(screen.getByTestId('property-about-description').textContent).toBe(FULL_DESCRIPTION);
  });

  it('falls back to the Short description when the Full description is empty', async () => {
    mockFetchListingById.mockResolvedValue({ id: 637, longDescription: '', shortDescription: 'Stylish 2BHK near UB City.' });

    render(page());

    const about = await screen.findByTestId('property-about-description');
    expect(about.textContent).toBe('Stylish 2BHK near UB City.');
    expect(screen.queryByRole('button', { name: /read more/i })).not.toBeInTheDocument();
  });

  it('shows "Ask them about this home" only once GET /listings/{id} confirms the host wrote neither', async () => {
    let answer: (value: unknown) => void = () => {};
    mockFetchListingById.mockReturnValue(new Promise((resolve) => { answer = resolve; }));

    render(page());

    await screen.findByTestId('property-about-section');
    expect(screen.queryByTestId('property-about-ask-host')).not.toBeInTheDocument();

    answer({ id: 637, longDescription: null, shortDescription: null });

    expect(await screen.findByTestId('property-about-ask-host')).toHaveTextContent(/hasn.t added a description yet/i);
    expect(screen.queryByTestId('property-about-description')).not.toBeInTheDocument();
  });

  it('keeps the description when the list re-resolve replaces the page row', async () => {
    // Direct load: the list has not landed, so the page resolves through GET /listings/{id} first…
    mockUseTenantListings.mockReturnValue(listState([]));
    mockFetchListingById.mockResolvedValue({ id: 637, longDescription: 'Host-written description.' });

    const { rerender } = render(page());
    expect(await screen.findByTestId('property-about-description')).toHaveTextContent('Host-written description.');

    // …then GET /listings/public lands and the page row is rebuilt from it (no description there).
    mockUseTenantListings.mockReturnValue(listState([{ ...LIST_ROW }]));
    rerender(page());

    await waitFor(() => expect(screen.getAllByTestId('property-check-in-time').length).toBeGreaterThan(0));
    expect(screen.getByTestId('property-about-description')).toHaveTextContent('Host-written description.');
    expect(screen.queryByTestId('property-about-ask-host')).not.toBeInTheDocument();
  });
});
