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

export const UPI_PROVIDERS = ['UPI_QR', 'UPI_DEEPLINK', 'RAZORPAY_DYNAMIC_QR'] as const;
export type UpiProvider = (typeof UPI_PROVIDERS)[number];

export interface UpiOrder {
  provider: UpiProvider;
  upiUri: string;
  upiVpa: string;
  /** May be empty when the API could not draw one; the panel then shows the address only. */
  qrCodeUrl: string;
  /** The UPI reference (`ATL-<bookingId>-<n>`), shown so the guest can quote it to the host. */
  reference: string;
  /** PAY-052: Razorpay Dynamic UPI QR (auto-confirms via `qr_code.credited` webhook without "I have paid"). */
  isDynamicQr?: boolean;
  qrCodeId?: string | null;
  qrImageUrl?: string | null;
  expiresAtUtc?: string | null;
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
  const isDynamicFlag = d.isDynamicQr === true || (typeof d.qrCodeId === 'string' && d.qrCodeId.trim().length > 0);
  if (!isUpiProvider(d.provider) && !isDynamicFlag) return null;
  const normalizedProvider = isUpiProvider(d.provider)
    ? ((d.provider as string).trim().toUpperCase() as UpiProvider)
    : 'RAZORPAY_DYNAMIC_QR';
  const isDynamicQr = isDynamicFlag || normalizedProvider === 'RAZORPAY_DYNAMIC_QR';
  const upiUri = typeof d.upiUri === 'string' ? d.upiUri.trim() : '';
  const upiVpa = typeof d.upiVpa === 'string' ? d.upiVpa.trim() : typeof d.keyId === 'string' ? d.keyId.trim() : '';
  const qr = typeof d.qrCodeUrl === 'string' ? d.qrCodeUrl.trim() : '';
  const qrImageUrl = typeof d.qrImageUrl === 'string' ? d.qrImageUrl.trim() : '';
  if (!isDynamicQr && (!upiUri.toLowerCase().startsWith('upi://pay?') || !upiVpa)) {
    throw new Error('Checkout error: the UPI payment details are missing. Please try again or contact the host.');
  }
  if (isDynamicQr && !qrImageUrl && !qr && !upiUri) {
    throw new Error('Checkout error: the UPI QR details are missing. Please try again or contact the host.');
  }
  return {
    provider: normalizedProvider,
    upiUri,
    upiVpa,
    // For static UPI, only an inline image is accepted; for Razorpay Dynamic QR, https:// Razorpay QR image URLs are also valid.
    qrCodeUrl: qr.startsWith('data:image/') || (isDynamicQr && qr.startsWith('https://')) ? qr : '',
    reference: typeof d.orderId === 'string' ? d.orderId : '',
    ...(isDynamicQr ? { isDynamicQr: true } : {}),
    ...(typeof d.qrCodeId === 'string' && d.qrCodeId.trim() ? { qrCodeId: d.qrCodeId.trim() } : {}),
    ...(qrImageUrl ? { qrImageUrl } : {}),
    ...(typeof d.expiresAtUtc === 'string' && d.expiresAtUtc.trim() ? { expiresAtUtc: d.expiresAtUtc.trim() } : {}),
  };
}
