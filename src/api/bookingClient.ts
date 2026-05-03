import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

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
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as BookingConfirmation;
}
