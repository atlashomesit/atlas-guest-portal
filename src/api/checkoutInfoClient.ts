/**
 * Founder ruling 2026-10-19 (website booking overhaul): everything the details/payment step needs to know about
 * the LISTING OWNER — the host's own house rules, the host's own WhatsApp / phone, and whether the host can take an
 * online payment at all. Read from `GET /api/public/listings/{id}/checkout-info`, which resolves the listing's own
 * tenant, so it is correct on a host's own site, on the atlastays.com marketplace and in the embed widget alike.
 *
 * Never falls back to Atlas's own number: a host with no number returns null and the portal shows no WhatsApp button.
 */
import { buildApiUrl, getApiHeaders } from '@/api/client';

export interface ListingCheckoutInfo {
  listingId: number;
  hostName: string | null;
  /** True only when the host wrote any rule — the required "I accept the house rules" tick shows only then. */
  hasHouseRules: boolean;
  houseRulesText: string | null;
  houseRulesPdfUrl: string | null;
  /** Raw structured-rules JSON object (smoking, pets, parties, kidsWelcome, quietHoursStart/End). */
  houseRulesStructuredJson: string | null;
  /** The HOST's WhatsApp number, digits only (null when none). */
  hostWhatsAppDigits: string | null;
  /** The HOST's phone for a call link, digits only (null when none). */
  hostPhoneDigits: string | null;
  bookingMode: string | null;
  /** False means hand the guest to the host instead of calling POST /api/Razorpay/order. */
  onlinePaymentsAvailable: boolean;
}

const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v : null);

/** Returns null when the listing is unknown or the request fails; callers must treat null as "no extra info" and never block a booking on it. */
export async function fetchListingCheckoutInfo(
  listingId: number,
  explicitTenant?: string | null,
  signal?: AbortSignal,
): Promise<ListingCheckoutInfo | null> {
  if (!Number.isFinite(listingId) || listingId <= 0) return null;
  try {
    const res = await fetch(buildApiUrl(`/api/public/listings/${Math.trunc(listingId)}/checkout-info`), {
      headers: { Accept: 'application/json', ...getApiHeaders(explicitTenant) },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      listingId: Number(data.listingId ?? listingId),
      hostName: asString(data.hostName),
      hasHouseRules: data.hasHouseRules === true,
      houseRulesText: asString(data.houseRulesText),
      houseRulesPdfUrl: asString(data.houseRulesPdfUrl),
      houseRulesStructuredJson: asString(data.houseRulesStructuredJson),
      hostWhatsAppDigits: asString(data.hostWhatsAppDigits),
      hostPhoneDigits: asString(data.hostPhoneDigits),
      bookingMode: asString(data.bookingMode),
      // Unknown or missing is treated as "available": the order endpoint stays the final judge.
      onlinePaymentsAvailable: data.onlinePaymentsAvailable !== false,
    };
  } catch {
    return null;
  }
}
