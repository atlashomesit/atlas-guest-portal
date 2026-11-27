import React from 'react';

export interface EmiAffordabilityHintProps {
  totalInr: number;
  emiEnabled: boolean;
  minOrderInr?: number;
  maxTenureMonths?: number;
  payLaterEnabled?: boolean;
}

export function calculateLowestMonthlyEmi(totalInr: number, maxTenureMonths = 6): number {
  if (totalInr <= 0 || maxTenureMonths <= 0) return 0;
  return Math.ceil(totalInr / maxTenureMonths);
}

export const EmiAffordabilityHint: React.FC<EmiAffordabilityHintProps> = ({
  totalInr,
  emiEnabled,
  minOrderInr = 3000,
  maxTenureMonths = 6,
  payLaterEnabled = false,
}) => {
  if (!emiEnabled || totalInr < minOrderInr) return null;
  const monthly = calculateLowestMonthlyEmi(totalInr, maxTenureMonths);

  return (
    <div
      data-testid="emi-affordability-hint"
      className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-900"
    >
      <span className="font-semibold">EMI from ₹{monthly.toLocaleString('en-IN')}/mo</span>
      {payLaterEnabled && <span className="text-indigo-700">· Pay Later available</span>}
    </div>
  );
};
