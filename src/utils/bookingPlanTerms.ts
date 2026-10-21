import { describeCancellationPolicy } from '@/utils/cancellationPolicy';

/**
 * GUEST-029: the plan terms the guest accepted, in plain words, for the booking confirmation card.
 *
 * Display only. Every value comes from fields the booking summary already returns
 * (`mealPlanCode`, `cancellationPolicy`); nothing is recomputed. The internal/OTA plan name
 * (`ratePlanName`, e.g. "Atlas501_PH . Double") is deliberately never rendered (founder ruling 2026-10-21).
 * Cancellation wording comes from `describeCancellationPolicy`, the same source the checkout widget uses,
 * so it cannot drift from the refund the server computes.
 */
export interface BookingPlanTerms {
  /** e.g. "Breakfast included". Null when the plan has no meals (room only) or the code is unknown. */
  mealLabel: string | null;
  /** e.g. "Non-refundable rate" / "Full refund if cancelled 7+ days before check-in". Null when absent. */
  cancellationHeadline: string | null;
  /** e.g. "No refund within 7 days of check-in." Null when there is nothing more to say. */
  cancellationDetail: string | null;
}

const MEAL_LABEL_BY_CODE: Record<string, string> = {
  BB: 'Breakfast included',
  CP: 'Breakfast included',
  HB: 'Breakfast and dinner included',
  MAP: 'Breakfast and dinner included',
  FB: 'All meals included',
  AP: 'All meals included',
  AI: 'All meals and drinks included',
};

function isNonRefundable(policy: string): boolean {
  return /^non[-_ ]?refundable$/i.test(policy);
}

function tierFor(policy: string): 'Flexible' | 'Moderate' | 'Strict' | null {
  const p = policy.toLowerCase();
  if (p === 'flexible') return 'Flexible';
  if (p === 'moderate') return 'Moderate';
  if (p === 'strict' || p === 'firm') return 'Strict';
  return null;
}

export function resolveBookingPlanTerms(
  mealPlanCode: string | null | undefined,
  cancellationPolicy: string | null | undefined,
): BookingPlanTerms {
  const code = (mealPlanCode ?? '').trim().toUpperCase();
  const mealLabel = MEAL_LABEL_BY_CODE[code] ?? null;

  const policy = (cancellationPolicy ?? '').trim();
  let cancellationHeadline: string | null = null;
  let cancellationDetail: string | null = null;
  if (policy) {
    if (isNonRefundable(policy)) {
      cancellationHeadline = 'Non-refundable rate';
    } else {
      const tier = tierFor(policy);
      if (tier) {
        const copy = describeCancellationPolicy(tier);
        cancellationHeadline = copy.headline;
        cancellationDetail = copy.afterWindowCopy || null;
      }
    }
  }
  return { mealLabel, cancellationHeadline, cancellationDetail };
}
