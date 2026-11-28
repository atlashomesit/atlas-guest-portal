import React from 'react';
import type { PaymentPlanOptions } from '@/api/pricingClient';

export type PaymentPlanChoice = 'Full' | 'DepositNow' | 'ZeroDeposit' | 'Monthly';

interface PaymentPlanSelectorProps {
  paymentPlans?: PaymentPlanOptions | null;
  selectedPlan: PaymentPlanChoice;
  onChange: (plan: PaymentPlanChoice) => void;
  displayTotal: number;
  formatPrice: (inr: number) => string;
}

function formatDueIst(iso?: string | null): string {
  if (!iso) return '24 hours before free cancellation ends';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' IST';
}

export const PaymentPlanSelector: React.FC<PaymentPlanSelectorProps> = React.memo(({
  paymentPlans,
  selectedPlan,
  onChange,
  displayTotal,
  formatPrice,
}) => {
  if (!paymentPlans || (!paymentPlans.rnplEligible && !paymentPlans.monthlyEligible)) {
    return null;
  }

  const firstMonth = paymentPlans.monthlyInstalments?.[0] ?? null;

  return (
    <div
      className="rounded-2xl border border-border-subtle bg-bg-surface p-4 space-y-2.5 mb-5"
      data-testid="payment-plan-selector"
      role="radiogroup"
      aria-label="Choose how to pay"
    >
      <div className="text-sm font-semibold text-text-primary">Choose how to pay</div>

      <label
        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-[44px] ${
          selectedPlan === 'Full' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle'
        }`}
        data-testid="payment-plan-option-Full"
      >
        <input
          type="radio"
          name="paymentPlan"
          value="Full"
          checked={selectedPlan === 'Full'}
          onChange={() => onChange('Full')}
          className="mt-1"
        />
        <div className="flex-1 text-sm">
          <div className="flex items-center justify-between gap-2 font-semibold text-text-primary">
            <span>Pay in full now</span>
            <span>{formatPrice(displayTotal)}</span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            One-time payment of {formatPrice(displayTotal)} today.
          </p>
        </div>
      </label>

      {paymentPlans.rnplEligible && (
        <label
          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-[44px] ${
            selectedPlan === 'DepositNow' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle'
          }`}
          data-testid="payment-plan-option-DepositNow"
        >
          <input
            type="radio"
            name="paymentPlan"
            value="DepositNow"
            checked={selectedPlan === 'DepositNow'}
            onChange={() => onChange('DepositNow')}
            className="mt-1"
          />
          <div className="flex-1 text-sm">
            <div className="flex items-center justify-between gap-2 font-semibold text-text-primary">
              <span>Reserve now, pay later ({paymentPlans.reserveDepositPercent}% deposit)</span>
              <span>{formatPrice(paymentPlans.depositAmountNow)} now</span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Pay {formatPrice(paymentPlans.depositAmountNow)} today, then {formatPrice(paymentPlans.remainingBalanceAmount)} by {formatDueIst(paymentPlans.balanceDueAtUtc)}.
            </p>
          </div>
        </label>
      )}

      {paymentPlans.rnplEligible && paymentPlans.allowZeroDepositReserve && (
        <label
          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-[44px] ${
            selectedPlan === 'ZeroDeposit' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle'
          }`}
          data-testid="payment-plan-option-ZeroDeposit"
        >
          <input
            type="radio"
            name="paymentPlan"
            value="ZeroDeposit"
            checked={selectedPlan === 'ZeroDeposit'}
            onChange={() => onChange('ZeroDeposit')}
            className="mt-1"
          />
          <div className="flex-1 text-sm">
            <div className="flex items-center justify-between gap-2 font-semibold text-text-primary">
              <span>Reserve for ₹0 today</span>
              <span>₹0 now</span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Instant confirmation with ₹0 charged today. Pay {formatPrice(displayTotal)} by {formatDueIst(paymentPlans.balanceDueAtUtc)}.
            </p>
          </div>
        </label>
      )}

      {paymentPlans.monthlyEligible && firstMonth && (
        <label
          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-[44px] ${
            selectedPlan === 'Monthly' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle'
          }`}
          data-testid="payment-plan-option-Monthly"
        >
          <input
            type="radio"
            name="paymentPlan"
            value="Monthly"
            checked={selectedPlan === 'Monthly'}
            onChange={() => onChange('Monthly')}
            className="mt-1"
          />
          <div className="flex-1 text-sm">
            <div className="flex items-center justify-between gap-2 font-semibold text-text-primary">
              <span>Pay monthly ({paymentPlans.monthlyInstalments.length} instalments)</span>
              <span>{formatPrice(firstMonth.amount)} today</span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Pay Month 1 today; remaining 30-night instalments open 10 days before each month starts.
            </p>
            {selectedPlan === 'Monthly' && (
              <ul className="mt-2 space-y-1 text-xs text-text-secondary border-t border-border-subtle pt-2" data-testid="monthly-instalments-preview">
                {paymentPlans.monthlyInstalments.map((inst) => (
                  <li key={inst.monthNumber} className="flex items-center justify-between gap-2">
                    <span>
                      Month {inst.monthNumber} ({inst.periodStart} to {inst.periodEnd}) · due {inst.dueDate}
                    </span>
                    <span className="font-medium text-text-primary">{formatPrice(inst.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>
      )}
    </div>
  );
});

export default PaymentPlanSelector;
