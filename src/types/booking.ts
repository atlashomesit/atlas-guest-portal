export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';

export type BookingSource = 'mock' | 'api';

/**
 * Booking DTO contract expected from backend.
 * Dates are ISO strings (YYYY-MM-DD). checkOutDate is exclusive.
 */
export interface BookingDTO {
  id: string;
  listingId: string;
  checkInDate: string; // inclusive
  checkOutDate: string; // exclusive
  source?: BookingSource;
  status?: BookingStatus;
}

