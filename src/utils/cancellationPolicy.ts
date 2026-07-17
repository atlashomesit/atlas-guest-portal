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

/**
 * TASK-4356 (founder decision, 2026-07-02): a listing with NO explicit cancellationTier gets a
 * 7-day (168h) free-cancellation window by default — mirrors the server default in
 * `Atlas.Api/Services/Bookings/CancellationPolicyWindow.cs`. Hosts change this per listing in
 * AtlasPMS ("Cancellation policy" cards on the listing edit page).
 */
export const DEFAULT_FREE_CANCELLATION_WINDOW_HOURS = 168;

/**
 * TASK-4405 (founder ruling, 2026-07-16): platform default for the universal "book with confidence"
 * post-booking free-cancellation grace window — mirrors `CancellationPolicyWindow.PlatformDefaultGraceHours`
 * / `Cancellation:UniversalGraceHoursDefault` in atlas-api. Marketing-copy-only constant for surfaces with
 * no listing/booking context (e.g. the homepage hero trust strip) — any surface that HAS a listing or
 * booking in scope must use the server-resolved `PublicListing.graceHours` instead of this constant.
 */
export const PLATFORM_DEFAULT_GRACE_HOURS = 24;

/** @deprecated Only used by the local fallback map when no server-sourced tier/hours are available. */
export const DEFAULT_CANCELLATION_TIER: CancellationTier = 'Flexible';

function isCancellationTier(value: unknown): value is CancellationTier {
  return value === 'Flexible' || value === 'Moderate' || value === 'Strict';
}

/**
 * Computes the absolute free-cancellation deadline (as a JS Date) for a given check-in date.
 * `checkInDate` should be the IST calendar date the guest selected (time-of-day is ignored —
 * check-in is treated as IST midnight, consistent with `getIstStartOfDay` used elsewhere).
 *
 * `windowHoursOverride` should be `PublicListing.cancellationWindowHours` (server-computed,
 * always populated, defaults to 168 when the listing has no tier) — pass it whenever available so
 * the guest-visible deadline can never drift from what the server actually stamps on the booking.
 * When absent (e.g. an older cached listing payload), falls back to the local tier→hours map, and
 * to `DEFAULT_FREE_CANCELLATION_WINDOW_HOURS` when the tier itself is unrecognized.
 */
export function computeCancellationDeadline(
  checkInDate: Date,
  tier: CancellationTier | string | null | undefined,
  windowHoursOverride?: number | null,
): Date {
  const windowHours =
    typeof windowHoursOverride === 'number' && windowHoursOverride > 0
      ? windowHoursOverride
      : isCancellationTier(tier)
        ? FREE_CANCELLATION_WINDOW_HOURS[tier]
        : DEFAULT_FREE_CANCELLATION_WINDOW_HOURS;
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

/**
 * TASK-4405: the effective free-cancellation deadline including the universal "book with confidence"
 * post-booking grace window — mirrors `CancellationPolicyWindow.ComputeEffectiveFreeCancellationDeadlineUtc`
 * in atlas-api (later-of the tier deadline and the possibly-voided grace deadline). `graceHours` MUST come
 * from the server-resolved `PublicListing.graceHours` (booking/listing payload) — never hardcode 24
 * client-side, and never show a grace-window disclosure when `graceHours` is null/undefined (flag-off
 * parity: the server omits the field when `Cancellation:UniversalGraceEnabled` is off).
 */
export function computeEffectiveCancellationDeadline(
  checkInDate: Date,
  tier: CancellationTier | string | null | undefined,
  windowHoursOverride: number | null | undefined,
  bookingCreatedAt: Date,
  graceHours: number | null | undefined,
): Date {
  const tierDeadline = computeCancellationDeadline(checkInDate, tier, windowHoursOverride);

  if (typeof graceHours !== 'number' || graceHours <= 0) {
    return tierDeadline;
  }

  const checkInIstMidnight = DateTime.fromJSDate(checkInDate).setZone('Asia/Kolkata').startOf('day');
  const bookingCreatedAtDt = DateTime.fromJSDate(bookingCreatedAt);
  const graceVoided = checkInIstMidnight.minus({ hours: graceHours }) < bookingCreatedAtDt;
  if (graceVoided) {
    return tierDeadline;
  }

  const graceDeadline = bookingCreatedAtDt.plus({ hours: graceHours }).toJSDate();
  return graceDeadline.getTime() > tierDeadline.getTime() ? graceDeadline : tierDeadline;
}
