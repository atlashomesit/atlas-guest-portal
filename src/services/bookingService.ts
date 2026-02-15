import { getMockBookingsForListing } from '@/mocks/bookings';
import { type BookingDTO } from '@/types/booking';

const warnedListings = new Set<string>();

/**
 * Fetch bookings for a specific listing.
 * Currently uses mock data; replace with real API when available.
 */
export const getBookingsForListing = async (listingId: string): Promise<BookingDTO[]> => {
  if (!warnedListings.has(listingId)) {
    // Warn once per listing to avoid console noise while making it clear data is mocked
    console.warn(`🎭 [Mock API] Using mock bookings for listing ${listingId}. Configure backend to use live data.`);
    warnedListings.add(listingId);
  }
  // Future: swap to real API call here
  return getMockBookingsForListing(String(listingId));
};

