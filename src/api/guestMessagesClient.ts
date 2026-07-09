import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/** TASK-4333: guest-facing message thread tied to a booking. */
export type GuestConversationMessage = {
  id: number;
  /** "Guest" or "Host". */
  sender: string;
  body: string;
  sentAtUtc: string;
};

export type GuestConversationThread = {
  conversationId: number | null;
  messages: GuestConversationMessage[];
  /** TASK-4359: true if the host has replied since the guest last viewed this thread. */
  hasUnreadMessages?: boolean;
};

/** Contract: GET /api/guest/bookings/{bookingId}/messages?t={token} */
export async function fetchGuestMessages(
  bookingId: number,
  token: string,
  signal?: AbortSignal,
): Promise<GuestConversationThread> {
  const response = await fetch(
    buildApiUrl(`/api/guest/bookings/${bookingId}/messages?t=${encodeURIComponent(token)}`),
    { signal, headers: { Accept: 'application/json', ...getApiHeaders() } },
  );

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as GuestConversationThread;
}

/** Contract: POST /api/guest/bookings/{bookingId}/messages?t={token} */
export async function sendGuestMessage(
  bookingId: number,
  token: string,
  body: string,
): Promise<GuestConversationMessage> {
  const response = await fetch(
    buildApiUrl(`/api/guest/bookings/${bookingId}/messages?t=${encodeURIComponent(token)}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getApiHeaders() },
      body: JSON.stringify({ body }),
    },
  );

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as GuestConversationMessage;
}
