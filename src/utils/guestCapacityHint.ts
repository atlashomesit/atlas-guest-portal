/**
 * GUEST-066: when max guests is below the bedroom count read from the listing name or type, a family cannot book.
 * Mirrors the admin listing-drawer warning (atlas-admin-portal guestCapacityHint.ts); display-only on the guest site.
 */
import { isHostelDormType } from '@/utils/dormListing';

const BEDROOM_WORD = /(\d{1,2})\s*[-\s]?\s*(?:bhk|bed\s?rooms?|br)\b/i;

export function parseBedroomCount(text: unknown): number | null {
  const match = BEDROOM_WORD.exec(String(text ?? ''));
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export type GuestCapacityHint = { bedrooms: number; guests: number };

export function guestCapacityHint(input: {
  maxGuests: number | null | undefined;
  listingType?: string | null;
  listingName?: string | null;
  accommodationType?: string | null;
}): GuestCapacityHint | null {
  if (isHostelDormType(input.accommodationType)) return null;
  const guests = input.maxGuests;
  if (guests == null || !Number.isFinite(guests) || guests < 1) return null;
  const bedrooms = Math.max(
    parseBedroomCount(input.listingType) ?? 0,
    parseBedroomCount(input.listingName) ?? 0,
  );
  if (bedrooms < 2 || guests >= bedrooms) return null;
  return { bedrooms, guests };
}

/** One sentence for the booking box when the listing's guest cap looks low for its bedroom count. */
export function guestCapacityMismatchMessage(hint: GuestCapacityHint): string {
  const guestWord = hint.guests === 1 ? 'guest' : 'guests';
  return `This ${hint.bedrooms}-bedroom home is currently set to accept up to ${hint.guests} ${guestWord}. Contact the host if you need a larger party.`;
}