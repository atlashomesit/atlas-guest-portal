/**
 * FOUNDER-RULED 2026-11-03: a room whose host has not set its pricing yet cannot be quoted or charged. Every API entry point that can
 * reach that state answers HTTP 409
 *   { "code": "PRICING_NOT_CONFIGURED", "message": "This room can't be booked online yet. Please contact the host." }
 * (it used to be a 500, which the checkout turned into "Something went wrong").
 *
 * This is the one place the guest portal recognises that answer, so the checkout page, the embed widget and the price client all show the
 * API's own words instead of a generic failure. Nothing was held and no money moved when this is returned.
 */
export const PRICING_NOT_CONFIGURED_CODE = 'PRICING_NOT_CONFIGURED';

/** Shown only if the API's answer carries the code but no message (the API always sends one). */
export const PRICING_NOT_CONFIGURED_FALLBACK_MESSAGE = "This room can't be booked online yet. Please contact the host.";

/**
 * The sentence to show when an API answer (`status` + JSON `body`) is the PRICING_NOT_CONFIGURED 409, else `null`.
 * Keyed on the code AND the status, never on the wording, so a different 409 (dates just taken, a stay rule) is never mistaken for it.
 */
export function pricingNotConfiguredMessage(status: number | undefined, body: unknown): string | null {
  if (status !== 409 || !body || typeof body !== 'object') return null;
  const b = body as { code?: unknown; Code?: unknown; message?: unknown; Message?: unknown };
  const code = typeof b.code === 'string' ? b.code : typeof b.Code === 'string' ? b.Code : '';
  if (code.trim() !== PRICING_NOT_CONFIGURED_CODE) return null;
  const message = typeof b.message === 'string' ? b.message : typeof b.Message === 'string' ? b.Message : '';
  return message.trim() || PRICING_NOT_CONFIGURED_FALLBACK_MESSAGE;
}

/** Thrown by the fetch-based price client so a screen can tell "the host has not set pricing" from a failed request. */
export class PricingNotConfiguredError extends Error {
  readonly code = PRICING_NOT_CONFIGURED_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'PricingNotConfiguredError';
  }
}

export function isPricingNotConfiguredError(error: unknown): error is PricingNotConfiguredError {
  return error instanceof PricingNotConfiguredError
    || (error instanceof Error && (error as { code?: unknown }).code === PRICING_NOT_CONFIGURED_CODE);
}
