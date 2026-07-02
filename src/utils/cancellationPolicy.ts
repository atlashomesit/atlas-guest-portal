import { DateTime } from 'luxon';

/**
 * TASK-4334: Single source of truth for the free-cancellation window per listing
 * cancellation tier. These hour counts mirror the copy already shown in
 * `Homepage_PropertyDetails.tsx` (`getPpCancellationInfo`/`cancellationTierLabel`):
 * Flexible = 48h, Moderate = 5 days, Strict = 7 days before check-in.
 *
 * Evidence (2026-07-02): atlas-api has NO server-side global or per-tenant constant for
 * this window — `Listing.CancellationTier` (atlas-api/Atlas.Api/Models/Listing.cs) is the
 * only per-listing policy signal exposed to the guest portal today, via
 * `PublicListingDto.cancellationTier`. The actual fee/refund math
 * (`Atlas.Api/Services/Bookings/CancellationRefundCalculator.cs`) uses a per-booking
 * `RefundFreeUntilUtc` timestamp that is set explicitly by the caller (admin/import), not
 * derived from a fixed hour count — so there is no richer source of truth to read from.
 * If server-side per-tenant overrides of these hour counts are ever introduced, update
 * BOTH this map and `cancellationTierLabel`/`getPpCancellationInfo` in
 * `Homepage_PropertyDetails.tsx` together, or better, have both read from here.
 */
export type CancellationTier = 'Flexible' | 'Moderate' | 'Strict';

export const FREE_CANCELLATION_WINDOW_HOURS: Record<CancellationTier, number> = {
  Flexible: 48,
  Moderate: 5 * 24,
  Strict: 7 * 24,
};

/** Default tier used when a listing has no cancellationTier set (matches existing fallback copy). */
export const DEFAULT_CANCELLATION_TIER: CancellationTier = 'Flexible';

function isCancellationTier(value: unknown): value is CancellationTier {
  return value === 'Flexible' || value === 'Moderate' || value === 'Strict';
}

/**
 * Computes the absolute free-cancellation deadline (as a JS Date) for a given check-in
 * date and listing cancellation tier. `checkInDate` should be the IST calendar date the
 * guest selected (time-of-day is ignored — check-in is treated as IST midnight, consistent
 * with `getIstStartOfDay` used elsewhere for date-range logic).
 */
export function computeCancellationDeadline(
  checkInDate: Date,
  tier: CancellationTier | string | null | undefined,
): Date {
  const resolvedTier = isCancellationTier(tier) ? tier : DEFAULT_CANCELLATION_TIER;
  const windowHours = FREE_CANCELLATION_WINDOW_HOURS[resolvedTier];
  const checkInIst = DateTime.fromJSDate(checkInDate).setZone('Asia/Kolkata').startOf('day');
  return checkInIst.minus({ hours: windowHours }).toJSDate();
}

/**
 * Formats a cancellation deadline for guest display, e.g. "6:00 PM, 12 Jul".
 * Always rendered in IST (Asia/Kolkata) — the timezone every Atlas listing operates in today.
 */
export function formatCancellationDeadline(deadline: Date): string {
  return DateTime.fromJSDate(deadline)
    .setZone('Asia/Kolkata')
    .toFormat("h:mm a, d LLL");
}
