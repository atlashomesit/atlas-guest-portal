import { buildApiUrl, getApiHeaders } from './client';

export interface MultiRoomOption {
  listingId: number;
  name: string;
  maxGuests: number;
  nightlyRate: number;
  totalStayAmount: number;
  photoUrl?: string | null;
}

export interface MultiRoomOptionsResponse {
  enabled: boolean;
  maxRoomsPerBooking: number;
  propertyId: number;
  propertyName: string;
  currency: string;
  rooms: MultiRoomOption[];
}

export interface MultiRoomSelectionPayload {
  listingId: number;
  guests: number;
  includeBreakfast?: boolean;
  hasPets?: boolean;
  listingRatePlanId?: number | null;
}

export interface MultiRoomOrderRequestPayload {
  rooms: MultiRoomSelectionPayload[];
  checkinDate: string;
  checkoutDate: string;
  currency?: string;
  channel?: string;
  bookingSource?: string;
  holdGroupReference?: string;
  holdToken?: string;
  guestInfo?: {
    name: string;
    email: string;
    phone: string;
    marketingWhatsAppOptIn?: boolean;
  };
  guestConsentAccepted: boolean;
  guestPurposeConsents?: Record<string, boolean>;
  houseRulesAccepted?: boolean;
  dormGenderAcknowledged?: boolean;
  securityDepositAccepted?: boolean;
  notes?: string;
  guestNationality?: string;
}

export interface MultiRoomQuoteLine {
  bookingId: number;
  listingId: number;
  listingName: string;
  guests: number;
  baseAmount: number;
  convenienceFeeAmount: number;
  finalAmount: number;
}

export interface MultiRoomOrderResponse {
  isHoldOnly: boolean;
  groupReference: string;
  holdToken?: string | null;
  bookingToken?: string | null;
  holdExpiresAtUtc: string;
  keyId?: string | null;
  orderId?: string | null;
  amount: number;
  currency: string;
  leadBookingId: number;
  bookingIds: number[];
  rooms: MultiRoomQuoteLine[];
}

export async function fetchMultiRoomOptions(
  listingId: number,
  checkIn: string,
  checkOut: string,
  tenantSlug?: string | null,
  signal?: AbortSignal,
): Promise<MultiRoomOptionsResponse | null> {
  if (!Number.isFinite(listingId) || listingId <= 0 || !checkIn || !checkOut) return null;
  const url = new URL(buildApiUrl('/api/Razorpay/multi-room-options'));
  url.searchParams.set('listingId', String(listingId));
  url.searchParams.set('checkIn', checkIn);
  url.searchParams.set('checkOut', checkOut);

  const res = await fetch(url.toString(), {
    signal,
    headers: getApiHeaders(tenantSlug),
  });
  if (!res.ok) return null;
  return (await res.json()) as MultiRoomOptionsResponse;
}

export async function createMultiRoomOrder(
  payload: MultiRoomOrderRequestPayload,
  tenantSlug?: string | null,
): Promise<MultiRoomOrderResponse> {
  const res = await fetch(buildApiUrl('/api/Razorpay/multi-room-order'), {
    method: 'POST',
    headers: {
      ...getApiHeaders(tenantSlug),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'Could not complete multi-room reservation. Please review your selected rooms.',
    ) as Error & { status?: number; code?: string; listingId?: number; roomName?: string };
    err.status = res.status;
    err.code = typeof body?.code === 'string' ? body.code : undefined;
    err.listingId = typeof body?.listingId === 'number' ? body.listingId : undefined;
    err.roomName = typeof body?.roomName === 'string' ? body.roomName : undefined;
    throw err;
  }
  return body as MultiRoomOrderResponse;
}
