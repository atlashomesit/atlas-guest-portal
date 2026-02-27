import { buildApiUrl, getApiHeaders } from '@/api/client';

export type BookingConfirmation = {
  id?: number;
  bookingId?: number;
  externalReservationId?: string;
  listingId?: number;
  checkinDate?: string;
  checkoutDate?: string;
  paymentStatus?: string;
  totalAmount?: number;
  [key: string]: unknown;
};

/**
 * Fetch booking by external reservation id (e.g. for guest confirmation page).
 * Contract: GET /bookings/by-reference?externalReservationId=
 */
export async function fetchBookingByReference(
  externalReservationId: string,
  signal?: AbortSignal,
): Promise<BookingConfirmation | null> {
  const url = new URL(buildApiUrl('/bookings/by-reference'));
  url.searchParams.set('externalReservationId', externalReservationId);

  const response = await fetch(url.toString(), { signal, headers: getApiHeaders() });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Booking fetch failed with status ${response.status}`);
  }

  return (await response.json()) as BookingConfirmation;
}
