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
    if (c === 'EP' || c === 'RO') return 'Room only, no meals';
    if (c === 'CP' || c === 'BB') return 'Breakfast included';
    if (c === 'MAP' || c === 'HB') return 'Breakfast and dinner included';
    if (c === 'AP' || c === 'FB') return 'All meals included';
    if (c === 'AI') return 'All meals and drinks included';
    return plainMealLabel(code.trim());
  }
  return null;
}

/**
 * TASK-10299208: Returns true when a rate plan name is an internal/OTA SKU, occupancy tier,
 * or generic system default ("Atlas101 . Double", "Standard Rate", "Default", "BAR", etc.)
 * that must never be shown to a guest.
 */
export function isInternalOrDefaultRatePlanName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  const trimmed = name.trim();
  if (trimmed.includes(' . ') || trimmed.includes(' · ')) return true;
  if (/\b(single|double|triple|quadruple|quintuple|sextuple|septuple|octuple|\d+g)\b/i.test(trimmed)) {
    return true;
  }
  if (/\bbar\b/i.test(trimmed)) return true;
  if (/^standard(\s+rate)?$/i.test(trimmed)) return true;
  if (/^default(\s+rate)?$/i.test(trimmed)) return true;
  if (/\batlas\s*\d+/i.test(trimmed) || /^atlas\d+/i.test(trimmed)) return true;
  return false;
}

/**
 * TASK-1039948 / TASK-10299208: Direct booking pricing tier public display.
 * Renders selected rate plan badge (only when non-internal), meal plan badge in plain words,
 * and cancellation policy.
 */
export default function PricingTierDisplay({
  ratePlanName,
  cancellationPolicy,
  mealPlanLabel,
  mealPlanCode,
  className = '',
  isCompact = false,
}: PricingTierDisplayProps) {
  const safeRatePlanName = !isInternalOrDefaultRatePlanName(ratePlanName) ? ratePlanName!.trim() : null;
  const formattedCancel = formatCancellationPolicy(cancellationPolicy);
  const formattedMeal = formatMealPlan(mealPlanLabel, mealPlanCode);

  if (!safeRatePlanName && !formattedCancel && !formattedMeal) {
    return null;
  }

  return (
    <div
      data-testid="pricing-tier-display"
      className={`pricing-tier-display rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs text-emerald-950 ${
        isCompact ? 'space-y-1' : 'space-y-1.5'
      } ${className}`}
    >
      {(safeRatePlanName || formattedMeal) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {safeRatePlanName && (
            <span
              data-testid="selected-rate-plan-badge"
              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-0.5 font-medium text-white shadow-xs"
            >
              <span>🏷️</span>
              <span>{safeRatePlanName}</span>
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
      )}

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
