/**
 * GUEST-101: Combined wording, label, and 393px mobile layout polish helpers
 * across Home, Search, and Listing Detail.
 */

export const MOBILE_393_CLASSNAMES = {
  pageContainer: 'mx-auto w-full max-w-6xl px-3 sm:px-6 overflow-x-hidden',
  cardTitle: 'text-base sm:text-lg font-semibold leading-snug break-words',
  priceRow: 'flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1',
  primaryCta: 'w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-xl',
} as const;

export function formatGuestCountLabel(adults: number, children = 0): string {
  const safeAdults = Math.max(1, Math.floor(adults));
  const safeChildren = Math.max(0, Math.floor(children));
  const total = safeAdults + safeChildren;
  if (safeChildren === 0) {
    return `${safeAdults} ${safeAdults === 1 ? 'guest' : 'guests'}`;
  }
  return `${total} guests (${safeAdults} ${safeAdults === 1 ? 'adult' : 'adults'}, ${safeChildren} ${safeChildren === 1 ? 'child' : 'children'})`;
}

export function formatNightsLabel(nights: number): string {
  const n = Math.max(1, Math.floor(nights));
  return `${n} ${n === 1 ? 'night' : 'nights'}`;
}
