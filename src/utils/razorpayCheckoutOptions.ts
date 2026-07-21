/**
 * TASK-5202: Razorpay checkout display config — UPI Intent on mobile, collect fallback on desktop.
 * Extracted for unit tests; GuestDetailsPage merges the result into the full options object.
 */

export function isMobileCheckoutUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export type RazorpayCheckoutDisplayConfig = {
  config: {
    display: {
      blocks: Record<string, { name: string; instruments: Array<Record<string, unknown>> }>;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
  /** Top-level Razorpay `upi` option (Intent on mobile). */
  upi?: { flow: 'intent' } | { vpa: string };
  /** Extra `prefill` fields — omit `method`/`vpa` on mobile so Intent is not pinned to collect. */
  prefillExtras: Record<string, string>;
};

/**
 * Build Razorpay checkout display config. On mobile, prefer UPI Intent (one-tap app switch).
 * On desktop, reuse a saved VPA for collect when available. Cards/netbanking/wallet remain
 * available via `show_default_blocks` and explicit sequence ordering.
 */
export function buildRazorpayCheckoutDisplayConfig(
  lastUpiVpa: string,
  isMobile: boolean,
): RazorpayCheckoutDisplayConfig {
  const trimmedVpa = lastUpiVpa.trim();
  const prefillExtras: Record<string, string> = {};

  let upi: RazorpayCheckoutDisplayConfig['upi'];
  if (isMobile) {
    upi = { flow: 'intent' };
  } else if (trimmedVpa) {
    upi = { vpa: trimmedVpa };
    prefillExtras.vpa = trimmedVpa;
    prefillExtras.method = 'upi';
  }

  return {
    config: {
      display: {
        blocks: {
          upi_block: {
            name: 'Pay using UPI',
            instruments: [
              isMobile
                ? { method: 'upi', flows: ['intent', 'collect'] }
                : { method: 'upi' },
            ],
          },
          card_block: {
            name: 'Cards',
            instruments: [{ method: 'card' }],
          },
        },
        sequence: ['block.upi_block', 'block.card', 'block.netbanking', 'block.wallet'],
        preferences: { show_default_blocks: true },
      },
    },
    ...(upi ? { upi } : {}),
    prefillExtras,
  };
}
