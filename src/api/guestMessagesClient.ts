import { buildApiUrl, getApiHeaders } from '@/api/client';
import { messageFromApiResponse } from '@/utils/serverErrorFromResponse';

/** TASK-4333: guest-facing message thread tied to a booking. */
export type GuestConversationMessage = {
  id: number;
  /** "Guest" or "Host". */
  sender: string;
  body: string;
  sentAtUtc: string;
  /** TASK-101313: per-message delivery state ("pending" | "sent" | "delivered" | "read" | "failed"). Absent on older payloads. */
  status?: string;
  /** TASK-101313: delivery timestamp. Null when not yet delivered. */
  deliveredAtUtc?: string | null;
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

/** TASK-101313: typing-presence snapshot for one booking thread. */
export type GuestTypingState = {
  hostTyping: boolean;
  guestTyping: boolean;
};

/** Contract: GET /api/guest/bookings/{bookingId}/typing?t={token} */
export async function fetchGuestTypingState(
  bookingId: number,
  token: string,
  signal?: AbortSignal,
): Promise<GuestTypingState> {
  const response = await fetch(
    buildApiUrl(`/api/guest/bookings/${bookingId}/typing?t=${encodeURIComponent(token)}`),
    { signal, headers: { Accept: 'application/json', ...getApiHeaders() } },
  );

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as GuestTypingState;
}

/** Contract: POST /api/guest/bookings/{bookingId}/typing?t={token} */
export async function sendGuestTypingHeartbeat(
  bookingId: number,
  token: string,
): Promise<GuestTypingState> {
  const response = await fetch(
    buildApiUrl(`/api/guest/bookings/${bookingId}/typing?t=${encodeURIComponent(token)}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getApiHeaders() },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    throw new Error(await messageFromApiResponse(response));
  }

  return (await response.json()) as GuestTypingState;
}
