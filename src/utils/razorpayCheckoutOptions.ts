/**
 * TASK-5202: Razorpay checkout display config — UPI Intent on mobile, collect fallback on desktop.
 * Extracted for unit tests; GuestDetailsPage merges the result into the full options object.
 */

export function isMobileCheckoutUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export interface AllowedCheckoutMethods {
  upi?: boolean;
  card?: boolean;
  netbanking?: boolean;
  wallet?: boolean;
  emi?: boolean;
  paylater?: boolean;
}

const KNOWN_CHECKOUT_METHODS = ['upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater'] as const;

/**
 * PAY-054: Converts a property/tenant `allowedCheckoutMethods` / `allowedPaymentMethods` config
 * into Razorpay Checkout's `method` filter object (`{ upi, card, netbanking, wallet, ... }`).
 * Returns `undefined` when unset or when all methods are disabled (so checkout never locks guests out).
 */
export function buildRazorpayMethodFilter(
  allowed?: AllowedCheckoutMethods | null,
): Record<string, boolean> | undefined {
  if (!allowed || typeof allowed !== 'object') return undefined;
  const result: Record<string, boolean> = {};
  let anyDefined = false;
  let anyEnabled = false;
  for (const key of KNOWN_CHECKOUT_METHODS) {
    const val = allowed[key];
    if (typeof val === 'boolean') {
      result[key] = val;
      anyDefined = true;
      if (val) anyEnabled = true;
    }
  }
  if (!anyDefined || !anyEnabled) return undefined;
  return result;
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
  /** PAY-054: Top-level Razorpay `method` filter when property configures allowed payment methods. */
  method?: Record<string, boolean>;
};

/**
 * Build Razorpay checkout display config. On mobile, prefer UPI Intent (one-tap app switch).
 * On desktop, reuse a saved VPA for collect when available. Cards/netbanking/wallet remain
 * available via `show_default_blocks` and explicit sequence ordering, filtered by `allowedMethods`
 * when the host configures per-property payment methods (PAY-054).
 */
export function buildRazorpayCheckoutDisplayConfig(
  lastUpiVpa: string,
  isMobile: boolean,
  allowedMethods?: AllowedCheckoutMethods | null,
): RazorpayCheckoutDisplayConfig {
  const methodFilter = buildRazorpayMethodFilter(allowedMethods);
  const upiAllowed = methodFilter?.upi !== false;
  const cardAllowed = methodFilter?.card !== false;
  const netbankingAllowed = methodFilter?.netbanking !== false;
  const walletAllowed = methodFilter?.wallet !== false;

  const trimmedVpa = lastUpiVpa.trim();
  const prefillExtras: Record<string, string> = {};

  let upi: RazorpayCheckoutDisplayConfig['upi'];
  if (upiAllowed) {
    if (isMobile) {
      upi = { flow: 'intent' };
    } else if (trimmedVpa) {
      upi = { vpa: trimmedVpa };
      prefillExtras.vpa = trimmedVpa;
      prefillExtras.method = 'upi';
    }
  }

  const blocks: Record<string, { name: string; instruments: Array<Record<string, unknown>> }> = {};
  const sequence: string[] = [];

  if (upiAllowed) {
    blocks.upi_block = {
      name: 'Pay using UPI',
      instruments: [
        isMobile
          ? { method: 'upi', flows: ['intent', 'collect'] }
          : { method: 'upi' },
      ],
    };
    sequence.push('block.upi_block');
  }
  if (cardAllowed) {
    blocks.card_block = {
      name: 'Cards',
      instruments: [{ method: 'card' }],
    };
    sequence.push('block.card');
  }
  if (netbankingAllowed) {
    sequence.push('block.netbanking');
  }
  if (walletAllowed) {
    sequence.push('block.wallet');
  }

  return {
    config: {
      display: {
        blocks,
        sequence,
        preferences: { show_default_blocks: true },
      },
    },
    ...(upi ? { upi } : {}),
    prefillExtras,
    ...(methodFilter ? { method: methodFilter } : {}),
  };
}
