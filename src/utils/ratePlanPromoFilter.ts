/**
 * MRP-046: Restrict promo codes to chosen rate plans with optional per-plan discount override.
 */

export interface RatePlanPromoRule {
  code: string;
  defaultDiscountPct: number;
  allowedRatePlanIds?: string[];
  perPlanDiscountOverridePct?: Record<string, number>;
}

export interface PromoRatePlanResult {
  valid: boolean;
  discountPct: number;
  reason?: string;
}

export function resolvePromoForRatePlan(
  promo: RatePlanPromoRule,
  ratePlanId: string
): PromoRatePlanResult {
  if (
    promo.allowedRatePlanIds &&
    promo.allowedRatePlanIds.length > 0 &&
    !promo.allowedRatePlanIds.includes(ratePlanId)
  ) {
    return {
      valid: false,
      discountPct: 0,
      reason: `Promo code ${promo.code} is not valid for the selected rate plan`,
    };
  }
  const override = promo.perPlanDiscountOverridePct?.[ratePlanId];
  return {
    valid: true,
    discountPct: override != null ? override : promo.defaultDiscountPct,
  };
}
