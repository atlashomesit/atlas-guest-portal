/**
 * PAY-010: guest checkout for hosts whose payment provider is UPI_QR / UPI_DEEPLINK.
 *
 * For such a host `POST /api/Razorpay/order` creates no Razorpay order: it answers with `provider`, a `upi://pay?...`
 * link, the host's UPI address and a self-hosted QR. Launching Razorpay with that answer (the UPI address as the key)
 * fails, so the guest could not pay at all. The page must branch on `provider` and show the UPI panel instead.
 *
 * The guest's "I have paid" is a claim, never proof: the booking stays unpaid until the host confirms the money
 * arrived (HARD RULE 24 fail-safe). Nothing here may mark a booking paid.
 */

export const UPI_PROVIDERS = ['UPI_QR', 'UPI_DEEPLINK'] as const;
export type UpiProvider = (typeof UPI_PROVIDERS)[number];

export interface UpiOrder {
  provider: UpiProvider;
  upiUri: string;
  upiVpa: string;
  /** May be empty when the API could not draw one; the panel then shows the address only. */
  qrCodeUrl: string;
  /** The UPI reference (`ATL-<bookingId>-<n>`), shown so the guest can quote it to the host. */
  reference: string;
}

export function isUpiProvider(provider: unknown): provider is UpiProvider {
  return typeof provider === 'string' && (UPI_PROVIDERS as readonly string[]).includes(provider.trim().toUpperCase());
}

/**
 * The UPI half of an order response, or null when the order is a Razorpay order (then the caller launches Razorpay
 * exactly as before). A UPI provider without a usable link throws: never fall through to Razorpay with a UPI address.
 */
export function parseUpiOrder(data: unknown): UpiOrder | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isUpiProvider(d.provider)) return null;
  const upiUri = typeof d.upiUri === 'string' ? d.upiUri.trim() : '';
  const upiVpa = typeof d.upiVpa === 'string' ? d.upiVpa.trim() : typeof d.keyId === 'string' ? d.keyId.trim() : '';
  if (!upiUri.toLowerCase().startsWith('upi://pay?') || !upiVpa) {
    throw new Error('Checkout error: the UPI payment details are missing. Please try again or contact the host.');
  }
  const qr = typeof d.qrCodeUrl === 'string' ? d.qrCodeUrl.trim() : '';
  return {
    provider: (d.provider as string).trim().toUpperCase() as UpiProvider,
    upiUri,
    upiVpa,
    // Only an inline image: a remote QR URL could be swapped for someone else's UPI address.
    qrCodeUrl: qr.startsWith('data:image/') ? qr : '',
    reference: typeof d.orderId === 'string' ? d.orderId : '',
  };
}
