/**
 * MRP-052: Per-rate-plan prepayment and deposit policy overriding property-wide payment rules.
 */

export type PrepaymentMode = 'PAY_AT_PROPERTY' | 'PARTIAL_DEPOSIT' | 'FULL_PREPAYMENT';

export interface PrepaymentPolicy {
  mode: PrepaymentMode;
  depositPct?: number; // e.g. 25 for 25%
}

export interface ResolvedPrepayment {
  mode: PrepaymentMode;
  dueNowInr: number;
  dueAtPropertyInr: number;
  summaryLabel: string;
}

export function resolveRatePlanPrepayment(
  totalInr: number,
  propertyDefault: PrepaymentPolicy,
  ratePlanOverride?: PrepaymentPolicy | null
): ResolvedPrepayment {
  const effective = ratePlanOverride ?? propertyDefault;
  if (effective.mode === 'PAY_AT_PROPERTY') {
    return {
      mode: 'PAY_AT_PROPERTY',
      dueNowInr: 0,
      dueAtPropertyInr: totalInr,
      summaryLabel: 'Pay ₹0 now · Pay at property',
    };
  }
  if (effective.mode === 'PARTIAL_DEPOSIT') {
    const pct = Math.min(100, Math.max(1, effective.depositPct ?? 25));
    const dueNowInr = Math.round((totalInr * pct) / 100);
    return {
      mode: 'PARTIAL_DEPOSIT',
      dueNowInr,
      dueAtPropertyInr: Math.max(0, totalInr - dueNowInr),
      summaryLabel: `Pay ${pct}% (₹${dueNowInr.toLocaleString('en-IN')}) now · Balance at property`,
    };
  }
  return {
    mode: 'FULL_PREPAYMENT',
    dueNowInr: totalInr,
    dueAtPropertyInr: 0,
    summaryLabel: `Full prepayment (₹${totalInr.toLocaleString('en-IN')}) due now`,
  };
}
