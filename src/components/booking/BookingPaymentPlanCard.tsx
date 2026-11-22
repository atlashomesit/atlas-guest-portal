import React from "react";
import { Link } from "react-router-dom";

export interface GuestBookingInstalment {
  id: number;
  monthNumber: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  payableFromDate: string;
  dueDate: string;
  status: string;
  paidAtUtc?: string | null;
  payLinkToken?: string | null;
}

interface BookingPaymentPlanCardProps {
  currency?: string;
  paymentPlan?: string | null;
  balanceDueAtUtc?: string | null;
  depositPercent?: number | null;
  amountReceived?: number;
  balanceDue?: number;
  payLinkToken?: string | null;
  instalments?: GuestBookingInstalment[] | null;
  isCancelled: boolean;
}

function formatInr(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

export const BookingPaymentPlanCard: React.FC<BookingPaymentPlanCardProps> = ({
  currency = "INR",
  paymentPlan,
  balanceDueAtUtc,
  depositPercent,
  amountReceived = 0,
  balanceDue = 0,
  payLinkToken,
  instalments,
  isCancelled,
}) => {
  const isRnpl = paymentPlan === "DepositNow" || paymentPlan === "ZeroDeposit";
  const isMonthly = paymentPlan === "Monthly" && Array.isArray(instalments) && instalments.length > 0;
  if (!isRnpl && !isMonthly) return null;

  return (
    <section
      className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5 space-y-3"
      data-testid="guest-payment-plan-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Your payments</h2>
        <span className="inline-flex items-center rounded-full bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 text-xs font-medium">
          {paymentPlan === "ZeroDeposit"
            ? "₹0 Reserve now, pay later"
            : paymentPlan === "DepositNow"
              ? `${depositPercent ?? 25}% Deposit plan`
              : "Monthly instalments"}
        </span>
      </div>

      {isRnpl && (
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="flex items-center justify-between">
            <span>Paid so far</span>
            <span className="font-medium text-text-primary">{formatInr(amountReceived, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Remaining balance</span>
            <span className="font-semibold text-text-primary">{formatInr(balanceDue, currency)}</span>
          </div>
          {balanceDue > 0 && balanceDueAtUtc && (
            <p className="text-xs text-text-muted">
              Due by{" "}
              <strong className="text-text-primary">
                {new Date(balanceDueAtUtc).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                IST
              </strong>
              . Bookings with unpaid balances cancel automatically after the deadline.
            </p>
          )}
          {!isCancelled && balanceDue > 0 && payLinkToken && (
            <div className="pt-1">
              <Link
                to={`/pay/${encodeURIComponent(payLinkToken)}`}
                className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-2.5 min-h-[44px] hover:bg-brand-primary/90 transition-colors"
                data-testid="rnpl-pay-balance-btn"
              >
                Pay remaining balance ({formatInr(balanceDue, currency)})
              </Link>
            </div>
          )}
        </div>
      )}

      {isMonthly && instalments && (
        <ul className="divide-y divide-border-subtle" data-testid="guest-monthly-instalments-list">
          {instalments.map((inst) => {
            const instToken = inst.payLinkToken || payLinkToken;
            const canPay = !isCancelled && inst.status !== "Paid" && instToken;
            return (
              <li
                key={inst.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                data-testid={`guest-instalment-row-${inst.monthNumber}`}
              >
                <div>
                  <p className="font-medium text-text-primary">
                    Month {inst.monthNumber}: {inst.periodStart} to {inst.periodEnd}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatInr(inst.amount, currency)} · Due {inst.dueDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      inst.status === "Paid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : inst.status === "Late"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : inst.status === "Due"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-gray-50 text-gray-700 border border-gray-200"
                    }`}
                  >
                    {inst.status}
                  </span>
                  {canPay && (
                    <Link
                      to={`/pay/${encodeURIComponent(instToken)}?instalmentId=${inst.id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-xs font-medium px-3 py-2 min-h-[44px] hover:bg-brand-primary/5 transition-colors"
                      data-testid={`guest-instalment-pay-${inst.monthNumber}`}
                    >
                      Pay by UPI
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default BookingPaymentPlanCard;
