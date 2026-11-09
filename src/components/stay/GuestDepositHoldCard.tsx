import { Link } from "react-router-dom";
import { HOLD_ENDS_SENTENCE, coversSentence } from "./depositHoldCopy";

/**
 * PAY-006 box 3 (guest half): the guest's own view of the refundable security-deposit card hold on the booking confirmation page.
 * The data is the booking summary's `depositHold` object (status words mirror Atlas.Api/Constants/DepositHoldStatuses.cs).
 * Renders nothing when the summary carries no hold, so older API builds and bookings without a deposit show no card.
 */
export type GuestDepositHold = {
  status: string;
  amountInr: number;
  capturedAmountInr?: number | null;
  /** ISO time the bank's authorization lapses (Authorized holds only). */
  holdExpiresAtUtc?: string | null;
  /** PAY-028: ISO time of the last moment the host can still charge this hold. Optional: an older API does not send it. */
  coversUntilUtc?: string | null;
};

const formatInr = (n: number): string => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

/** "3 days 4 hours left", "5 hours left", "12 minutes left" or "ended"; null without a usable expiry. */
// eslint-disable-next-line react-refresh/only-export-components -- co-located countdown helper
export function depositHoldTimeLeft(expiresAtUtc: string | null | undefined, nowMs: number): string | null {
  if (!expiresAtUtc) return null;
  const end = Date.parse(expiresAtUtc);
  if (!Number.isFinite(end)) return null;
  const mins = Math.floor((end - nowMs) / 60000);
  if (mins <= 0) return "ended";
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (days > 0) return `${plural(days, "day")}${hours > 0 ? ` ${plural(hours, "hour")}` : ""} left`;
  if (hours > 0) return `${plural(hours, "hour")} left`;
  return `${plural(mins, "minute")} left`;
}

function describe(hold: GuestDepositHold): { label: string; detail: string } {
  const amount = formatInr(hold.amountInr);
  switch (hold.status) {
    case "Authorized":
      return { label: "Held on your card", detail: `${amount} is held on your card, not charged. ${coversSentence(hold.coversUntilUtc)} ${HOLD_ENDS_SENTENCE}` };
    case "Captured":
      return {
        label: "Part of the hold was charged",
        detail: hold.capturedAmountInr != null
          ? `${formatInr(hold.capturedAmountInr)} of the ${amount} hold was charged for damage. The rest of the hold is not charged.`
          : `Part of the ${amount} hold was charged for damage. The rest of the hold is not charged.`,
      };
    case "Released":
      return { label: "Released", detail: `Your host has released the ${amount} hold. Nothing was charged. Your bank frees the money and may take a few more days to show it.` };
    case "Voided":
    case "Expired":
      return { label: "Hold ended", detail: `The ${amount} hold on your card has ended. Nothing was charged.` };
    case "Disputed":
      return { label: "Under review", detail: `The host has raised a question about the ${amount} deposit. They will contact you.` };
    case "AuthorizationPending":
      return { label: "Not placed yet", detail: `Please place the ${amount} refundable hold on your card before you arrive.` };
    default:
      return { label: hold.status || "Unknown", detail: `Security deposit ${amount}.` };
  }
}

export default function GuestDepositHoldCard({
  hold,
  bookingId,
  token,
  nowMs = Date.now(),
}: {
  hold: GuestDepositHold | null | undefined;
  bookingId: number | string;
  token?: string | null;
  /** Injectable clock for tests. */
  nowMs?: number;
}) {
  if (!hold || !hold.status) return null;
  const { label, detail } = describe(hold);
  const left = hold.status === "Authorized" ? depositHoldTimeLeft(hold.holdExpiresAtUtc, nowMs) : null;
  const depositPath = `/booking/${encodeURIComponent(String(bookingId))}/deposit${token ? `?t=${encodeURIComponent(token)}` : ""}`;
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5" data-testid="guest-deposit-hold-card">
      <h2 className="text-sm font-semibold text-text-primary mb-1">🔒 Security deposit</h2>
      <p className="text-sm font-medium text-text-primary" data-testid="guest-deposit-hold-status">{label}</p>
      <p className="text-sm text-text-secondary mt-0.5" data-testid="guest-deposit-hold-detail">{detail}</p>
      {left && (
        <p className="text-xs text-text-muted mt-1" data-testid="guest-deposit-hold-countdown">Bank authorization: {left}</p>
      )}
      {hold.status === "AuthorizationPending" && (
        <Link
          to={depositPath}
          data-testid="guest-deposit-hold-link"
          className="mt-3 inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-2 hover:bg-brand-primary/5 transition-colors"
        >
          Place the hold
        </Link>
      )}
    </div>
  );
}
