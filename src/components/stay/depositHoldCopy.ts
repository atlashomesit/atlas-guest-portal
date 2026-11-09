/**
 * PAY-028 (guest half): the words a guest reads about their security-deposit card hold.
 *
 * What is true (PAY-1109): the amount is HELD on the card, not charged. It covers the host's damage claims until a date (`coversUntilUtc`, the last
 * moment the host can still charge it). Releasing is bookkeeping on our side, so the money is not freed on the spot: after that date, or once the host
 * releases it, the guest's bank frees the held amount, and the bank may take a few more days to show it. The old promise "released after your stay /
 * after check-out if there is no damage" was not true and must not come back.
 */

/** "14 Nov 2026, 02:00 pm" in the guest's own time zone (the same options the booking page uses for "Failed at"), or null without a usable date. */
export function formatHoldDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "It covers damage claims until 14 Nov 2026, 02:00 pm." - or, with no date from the API, "It covers damage claims while it lasts." */
export function coversSentence(coversUntilUtc: string | null | undefined): string {
  const when = formatHoldDate(coversUntilUtc);
  return when ? `It covers damage claims until ${when}.` : "It covers damage claims while it lasts.";
}

/** How the hold ends. The bank, not Atlas, frees the money, and it may show a few days late. */
export const HOLD_ENDS_SENTENCE =
  "After that, or when your host releases it, your bank frees it; your bank may take a few more days to show it.";
