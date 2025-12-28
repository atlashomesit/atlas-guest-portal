import { getMockBookingsForListing } from '@/mocks/bookings';
import { type BookingDTO } from '@/types/booking';

/**
 * Fetch bookings for a specific listing.
 * Currently uses mock data; replace with real API when available.
 */
export const getBookingsForListing = async (listingId: string): Promise<BookingDTO[]> => {
  // Future: swap to real API call here
  return getMockBookingsForListing(String(listingId));
};

