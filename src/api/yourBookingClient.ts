import { buildApiUrl, getApiHeaders } from './client';
import { isMarketplaceMode } from '@/tenant/tenantResolver';

/**
 * TASK-10299444 / TASK-10299437: the guest's "Your booking" page data. The signed token in the link is the only credential and it names the tenant, so on the
 * marketplace host (where the WhatsApp button opens) no tenant header is sent at all; on a host's own site the host's tenant header goes along and the server
 * refuses a token that belongs to another tenant (same plain "link not valid" answer as an expired or tampered one).
 */
export interface YourBookingReceiptRow { label: string; value: string }

export interface YourBookingData {
  guestFirstName: string;
  homeName: string;
  brand: string | null;
  checkInDate: string;
  checkInTime: string | null;
  checkOutDate: string;
  checkOutTime: string | null;
  nights: number;
  reference: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | 'pending';
  isCancelled: boolean;
  statusMessage: string | null;
  directionsUrl: string | null;
  receipt: {
    title: string;
    note: string;
    currency: string;
    total: number;
    amountReceived: number | null;
    balance: number;
    paidThroughBookingSite: boolean;
    rows: YourBookingReceiptRow[];
    pdfPath: string;
  };
  houseRules: { text: string | null; pdfUrl: string | null } | null;
  otherRules: { json: string } | null;
  cancellationPolicy: {
    policyName: string | null;
    headline: string;
    detail: string;
    refundFreeUntilUtc: string | null;
    timezoneId: string | null;
  };
  agreementLine: string;
  supportPhone: string | null;
}

export type YourBookingResult =
  | { kind: 'ok'; data: YourBookingData }
  | { kind: 'invalid' }
  | { kind: 'error' };

function headers(): Record<string, string> {
  return isMarketplaceMode() ? {} : getApiHeaders();
}

export function yourBookingReceiptUrl(token: string): string {
  return buildApiUrl(`/api/public/your-booking/${encodeURIComponent(token)}/receipt.pdf`);
}

export async function fetchYourBooking(token: string): Promise<YourBookingResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/public/your-booking/${encodeURIComponent(token)}`), { headers: headers() });
    if (res.status === 404) return { kind: 'invalid' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', data: (await res.json()) as YourBookingData };
  } catch {
    return { kind: 'error' };
  }
}
