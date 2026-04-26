import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { BookingProvider } from '../../../contexts/BookingContext';
import { ListingPhotosProvider } from '../../../contexts/ListingPhotosContext';
import Homepage_PropertyDetails from './Homepage_PropertyDetails';

// Mock the child components that require significant setup
vi.mock('../../ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../commonComponents/subheading/Subheading', () => ({
  default: () => <div data-testid="subheading" />,
}));

vi.mock('../../SEO', () => ({
  default: () => <div data-testid="seo" />,
}));

vi.mock('../../availability/UnitBookingWidget', () => ({
  default: () => <div data-testid="booking-widget" />,
}));

vi.mock('../../AvailabilityCalendar', () => ({
  default: () => <div data-testid="availability-calendar" />,
}));

// Mock the data
vi.mock('../../../data.ts', () => ({
  propertyData: [],
  propertyImages: {},
}));

vi.mock('../../../config/policyConfig', () => ({
  getUnitPolicy: () => ({ cancellation: '' }),
}));

vi.mock('../../../content/terms', () => ({
  inlinePolicySnippets: { cancellation: 'Standard policy' },
}));

vi.mock('../../../api/listingClient', () => ({
  fetchListingById: vi.fn(),
  parseMaxGuestsFromPayload: vi.fn(() => 4),
  resolveStaticMaxGuests: vi.fn(() => 4),
}));

vi.mock('../../../contexts/ListingPhotosContext', () => ({
  useListingPhotosFromApi: () => ({
    getUrlsForListingId: vi.fn(() => []),
  }),
}));

vi.mock('../../../utils/guestImageUrl', () => ({
  filterGuestImageUrls: (arr: string[]) => arr,
  sanitizeGuestImageUrl: (url: string) => url,
}));

vi.mock('../../../utils/navigation', () => ({
  buildHomeUnitPath: (slug: string, id: number) => `/homes/${slug}/${id}`,
  getPropertySlug: () => 'test-property',
}));

vi.mock('../../../utils/guestHistory', () => ({
  addRecentlyViewed: vi.fn(),
  isFavorite: vi.fn(() => false),
  toggleFavorite: vi.fn(),
}));

vi.mock('../../../utils/formatting', () => ({
  formatCurrency: (val: number) => `₹${val}`,
  formatHumanDate: (date: string) => date,
}));

vi.mock('../../../utils/pricing', () => ({
  calculateNightlyPrice: vi.fn(() => ({ finalNightlyPrice: 5000 })),
  inferUnitType: vi.fn(() => 'room'),
}));

describe('Homepage_PropertyDetails - TASK-1185: notFound heading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Home Not Found" heading when listing not found', async () => {
    const { container } = render(
      <BrowserRouter>
        <BookingProvider>
          <ListingPhotosProvider>
            <Homepage_PropertyDetails />
          </ListingPhotosProvider>
        </BookingProvider>
      </BrowserRouter>,
      { timeout: 5000 }
    );

    // Wait for the component to process route params and set notFound state
    // Since listingIdParam will be undefined in test, it should eventually render notFound view
    const heading = await screen.findByRole('heading', { level: 1, name: /Home Not Found/i });
    expect(heading).toBeInTheDocument();
  });
});
