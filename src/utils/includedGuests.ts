/**
 * GUEST-060: say how many guests the price covers, and what each extra guest costs, using only what the
 * listing itself sends. Display only: no price is calculated here and nothing about a quote changes.
 * When the API sends no included-guest count the caller shows nothing (never a number made up for every host).
 */
export interface IncludedGuestFields {
  includedGuests: number | null;
  extraGuestRate: number | null;
  /** The API says guest-count prices apply but are not one simple per-extra-guest amount: say so, with no number. */
  priceChangesWithGuests?: boolean;
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
  const varies = p.priceChangesWithGuests === true || p.PriceChangesWithGuests === true;
  return {
    includedGuests: included != null ? Math.floor(included) : null,
    extraGuestRate: extra,
    ...(varies ? { priceChangesWithGuests: true } : {}),
  };
}

/**
 * The public listing reply is the one reply that always carries these facts; the catalog row and GET /listings/{id}
 * may not. Use the listing row's values only until that reply arrives, or if it failed.
 */
export function pickIncludedGuestFacts(
  publicFacts: IncludedGuestFields | null,
  listing: { includedGuests?: number | null; extraGuestRate?: number | null; priceChangesWithGuests?: boolean | null },
): IncludedGuestFields {
  if (publicFacts) return publicFacts;
  return {
    includedGuests: listing.includedGuests ?? null,
    extraGuestRate: listing.extraGuestRate ?? null,
    ...(listing.priceChangesWithGuests ? { priceChangesWithGuests: true } : {}),
  };
}

/**
 * "Price includes up to 2 guests, then ₹500 for each extra guest per night". The extra-guest clause appears only when the
 * host set a rate and the home sleeps more people than the price includes. When the API says the price follows the guest
 * count in a way one number cannot describe, the line says that instead and shows no number. Returns null when the
 * included count is unknown.
 *
 * GUEST-065: the old wording ("Includes 2 guests, ...") had no subject, so under a picked "1 adult" it read as a second,
 * different guest count. It now says what includes them (the price) and that 2 is a ceiling ("up to").
 */
export function describeIncludedGuests(
  includedGuests: number | null | undefined,
  extraGuestRate: number | null | undefined,
  maxGuests: number | null | undefined,
  formatAmount: (n: number) => string,
  priceChangesWithGuests?: boolean | null,
): string | null {
  if (includedGuests == null || !Number.isFinite(includedGuests) || includedGuests < 1) return null;
  const base = includedGuests === 1 ? 'Price includes 1 guest' : `Price includes up to ${includedGuests} guests`;
  const canHaveExtra = maxGuests == null || maxGuests > includedGuests;
  if (extraGuestRate != null && extraGuestRate > 0 && canHaveExtra) {
    return `${base}, then ${formatAmount(extraGuestRate)} for each extra guest per night`;
  }
  if (priceChangesWithGuests && canHaveExtra) return `${base}. It changes with the number of guests`;
  return base;
}
