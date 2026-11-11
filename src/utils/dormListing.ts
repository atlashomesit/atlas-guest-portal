/**
 * HSL-011: the dorm facts the guest portal reads from the listing payload (`GET /listings/{id}`,
 * `/listings/public`). Everything here comes from the API only: a listing whose payload does not carry
 * the field is NOT a dorm and has NO gender rule. Nothing is guessed from the listing name.
 */

export type DormGenderPolicy = 'FemaleOnly' | 'MaleOnly' | 'Mixed';

/** The API stores exactly these three values (Listing.DormGenderPolicy). Anything else is "not stated". */
export function parseDormGenderPolicy(raw: unknown): DormGenderPolicy | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'femaleonly') return 'FemaleOnly';
  if (v === 'maleonly') return 'MaleOnly';
  if (v === 'mixed') return 'Mixed';
  return null;
}

/** `Listing.AccommodationType === "HostelDorm"` - a bed is sold, not a room. */
export function isHostelDormType(accommodationType: unknown): boolean {
  return typeof accommodationType === 'string' && accommodationType.trim().toLowerCase() === 'hosteldorm';
}

/** A women-only / men-only dorm makes the guest acknowledge the rule before paying. */
export function dormNeedsGenderAcknowledgement(policy: DormGenderPolicy | null | undefined): boolean {
  return policy === 'FemaleOnly' || policy === 'MaleOnly';
}

export type DormListingFields = {
  accommodationType: string | null;
  dormGenderPolicy: DormGenderPolicy | null;
  /** Total beds in the dorm (`Listing.Quantity`). Null unless the payload carries a positive whole number. */
  bedCount: number | null;
};

function pick(raw: Record<string, unknown>, camel: string, pascal: string): unknown {
  return raw[camel] ?? raw[pascal];
}

/** Read the dorm fields from a listing payload (camelCase or PascalCase JSON, like every other client here). */
export function readDormListingFields(raw: Record<string, unknown> | null | undefined): DormListingFields {
  if (!raw) return { accommodationType: null, dormGenderPolicy: null, bedCount: null };
  const acc = pick(raw, 'accommodationType', 'AccommodationType');
  const qty = Number(pick(raw, 'quantity', 'Quantity'));
  return {
    accommodationType: typeof acc === 'string' && acc.trim() ? acc.trim() : null,
    dormGenderPolicy: parseDormGenderPolicy(pick(raw, 'dormGenderPolicy', 'DormGenderPolicy')),
    bedCount: Number.isInteger(qty) && qty > 0 ? qty : null,
  };
}

/**
 * Beds free for the whole stay: the smallest per-night count across the nights. Null when any night is
 * unknown or no night is given - the widget then shows no "left" line rather than a guess.
 */
export function bedsLeftForNights(
  nightIsos: string[],
  roomsAvailableByDate: ReadonlyMap<string, number>,
): number | null {
  if (nightIsos.length === 0) return null;
  let min = Infinity;
  for (const iso of nightIsos) {
    const n = roomsAvailableByDate.get(iso);
    if (n == null || !Number.isFinite(n) || n < 0) return null;
    if (n < min) min = n;
  }
  return Number.isFinite(min) ? min : null;
}
