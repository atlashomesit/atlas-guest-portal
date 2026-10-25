import { plainMealLabel } from '@/utils/directBookingPrice';

export interface PricingTierDisplayProps {
  ratePlanName?: string | null;
  cancellationPolicy?: string | null;
  mealPlanLabel?: string | null;
  mealPlanCode?: string | null;
  className?: string;
  isCompact?: boolean;
}

function formatCancellationPolicy(policy: string | null | undefined): string | null {
  if (!policy || !policy.trim()) return null;
  const trimmed = policy.trim();
  if (trimmed.toLowerCase() === 'nonrefundable' || trimmed.toLowerCase() === 'non-refundable') {
    return 'Non-refundable';
  }
  return trimmed;
}

function formatMealPlan(label?: string | null, code?: string | null): string | null {
  if (label && label.trim()) {
    return plainMealLabel(label);
  }
  if (code && code.trim()) {
    const c = code.trim().toUpperCase();
    if (c === 'EP') return 'Room only, no meals';
    if (c === 'CP') return 'Breakfast included';
    if (c === 'MAP') return 'Breakfast and dinner included';
    if (c === 'AP') return 'All meals included';
    return code.trim();
  }
  return null;
}

/**
 * TASK-1039948: Direct booking pricing tier public display.
 * Renders selected rate plan badge, meal plan badge, and cancellation policy.
 */
export default function PricingTierDisplay({
  ratePlanName,
  cancellationPolicy,
  mealPlanLabel,
  mealPlanCode,
  className = '',
  isCompact = false,
}: PricingTierDisplayProps) {
  const formattedCancel = formatCancellationPolicy(cancellationPolicy);
  const formattedMeal = formatMealPlan(mealPlanLabel, mealPlanCode);

  if (!ratePlanName && !formattedCancel && !formattedMeal) {
    return null;
  }

  return (
    <div
      data-testid="pricing-tier-display"
      className={`pricing-tier-display rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs text-emerald-950 ${
        isCompact ? 'space-y-1' : 'space-y-1.5'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {ratePlanName && (
          <span
            data-testid="selected-rate-plan-badge"
            className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-0.5 font-medium text-white shadow-xs"
          >
            <span>🏷️</span>
            <span>{ratePlanName}</span>
          </span>
        )}
        {formattedMeal && (
          <span
            data-testid="rate-plan-meal-badge"
            className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 border border-emerald-200"
          >
            <span>🍳</span>
            <span>{formattedMeal}</span>
          </span>
        )}
      </div>

      {formattedCancel && (
        <div
          data-testid="rate-plan-cancellation-policy"
          className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-900"
        >
          <span aria-hidden="true">✓</span>
          <span>{formattedCancel}</span>
        </div>
      )}
    </div>
  );
}
