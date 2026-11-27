/**
 * MRP-044: Early-Bird minimum advance days and Last-Minute maximum advance days
 * per rate plan across direct booking flows.
 */

export interface RatePlanAdvanceWindow {
  ratePlanId: string;
  name: string;
  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
}

export interface AdvanceWindowEvaluation {
  eligible: boolean;
  badge?: 'Early-Bird' | 'Last-Minute';
  reason?: string;
}

export function evaluateRatePlanAdvanceWindow(
  plan: RatePlanAdvanceWindow,
  daysUntilCheckIn: number
): AdvanceWindowEvaluation {
  const days = Math.max(0, Math.floor(daysUntilCheckIn));
  if (plan.minAdvanceDays != null && days < plan.minAdvanceDays) {
    return {
      eligible: false,
      reason: `Book at least ${plan.minAdvanceDays} days in advance for ${plan.name}`,
    };
  }
  if (plan.maxAdvanceDays != null && days > plan.maxAdvanceDays) {
    return {
      eligible: false,
      reason: `${plan.name} is only available within ${plan.maxAdvanceDays} days of check-in`,
    };
  }
  const badge =
    plan.minAdvanceDays != null && plan.minAdvanceDays >= 7
      ? 'Early-Bird'
      : plan.maxAdvanceDays != null && plan.maxAdvanceDays <= 7
        ? 'Last-Minute'
        : undefined;

  return { eligible: true, badge };
}
