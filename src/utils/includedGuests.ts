/**
 * GUEST-060: say how many guests the price covers, and what each extra guest costs, using only what the
 * listing itself sends. Display only: no price is calculated here and nothing about a quote changes.
 * When the API sends no included-guest count the caller shows nothing (never a number made up for every host).
 */
export interface IncludedGuestFields {
  includedGuests: number | null;
  extraGuestRate: number | null;
}

function positiveNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Reads the host's own included-guest count and extra-guest nightly rate from a listing payload. */
export function readIncludedGuestFields(payload: Record<string, unknown> | null | undefined): IncludedGuestFields {
  const p = payload ?? {};
  const included = positiveNumber(p.includedGuests ?? p.IncludedGuests ?? p.baseOccupancy ?? p.BaseOccupancy);
  const extra = positiveNumber(p.extraGuestRate ?? p.ExtraGuestRate);
  return { includedGuests: included != null ? Math.floor(included) : null, extraGuestRate: extra };
}

/**
 * "Includes 2 guests, then ₹500 per extra guest per night". The extra-guest clause appears only when the host set
 * a rate and the home sleeps more people than the price includes. Returns null when the included count is unknown.
 */
export function describeIncludedGuests(
  includedGuests: number | null | undefined,
  extraGuestRate: number | null | undefined,
  maxGuests: number | null | undefined,
  formatAmount: (n: number) => string,
): string | null {
  if (includedGuests == null || !Number.isFinite(includedGuests) || includedGuests < 1) return null;
  const base = `Includes ${includedGuests} guest${includedGuests === 1 ? '' : 's'}`;
  const canHaveExtra = maxGuests == null || maxGuests > includedGuests;
  if (extraGuestRate != null && extraGuestRate > 0 && canHaveExtra) {
    return `${base}, then ${formatAmount(extraGuestRate)} per extra guest per night`;
  }
  return base;
}
