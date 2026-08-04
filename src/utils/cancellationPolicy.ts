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
 * TASK-7012: the grace hours that ACTUALLY apply to this booking, or null when none do — the single
 * source of truth for "may we disclose the grace window to this guest?".
 *
 * Mirrors the server's void carve-out in
 * `CancellationPolicyWindow.ComputeEffectiveFreeCancellationDeadlineUtc` (founder ruling 2026-07-16):
 * the grace candidate is VOIDED when check-in falls inside the grace window measured from booking
 * time (`checkInLocalMidnight - graceHours < bookingCreatedAt`). A voided window is one the server
 * will NOT honour on cancellation, so no surface may advertise it — disclosing "free cancellation for
 * N hours after you book" in that case is a direct over-promise against
 * `CancellationRefundCalculator`.
 *
 * Returns null both when grace is voided and when no grace is configured (flag-off parity: the server
 * omits `graceHours` when `Cancellation:UniversalGraceEnabled` is off), because callers must stay
 * silent in both cases.
 */
export function resolveApplicableGraceHours(
  checkInDate: Date,
  bookingCreatedAt: Date,
  graceHours: number | null | undefined,
): number | null {
  if (typeof graceHours !== 'number' || graceHours <= 0) return null;
  const checkInIstMidnight = DateTime.fromJSDate(checkInDate).setZone('Asia/Kolkata').startOf('day');
  const graceVoided =
    checkInIstMidnight.minus({ hours: graceHours }) < DateTime.fromJSDate(bookingCreatedAt);
  return graceVoided ? null : graceHours;
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

  const applicableGraceHours = resolveApplicableGraceHours(checkInDate, bookingCreatedAt, graceHours);
  if (applicableGraceHours == null) {
    return tierDeadline;
  }

  const graceDeadline = DateTime.fromJSDate(bookingCreatedAt)
    .plus({ hours: applicableGraceHours })
    .toJSDate();
  return graceDeadline.getTime() > tierDeadline.getTime() ? graceDeadline : tierDeadline;
}

/** TASK-7012: true when the computed free-cancellation deadline is still in the future. */
export function isFreeCancellationDeadlineActive(deadline: Date, now: Date = new Date()): boolean {
  return deadline.getTime() > now.getTime();
}

/** TASK-7012: guest-facing trust-strip / pay-microcopy for free cancellation. */
export type FreeCancellationTrustCopy = {
  /** Full trust-strip sentence, or null when the grace-window strip alone covers the case. */
  trustMessage: string | null;
  /** Formatted deadline when still active — for hold payload / microcopy suffix. */
  deadlineFormatted: string | null;
  /**
   * TASK-7012: grace hours safe to DISCLOSE for this selection — null when the server would void the
   * grace window (or none is configured). Surfaces must gate their grace-window copy on this, never on
   * the raw listing `graceHours`: a listing-level grace value says the feature is on, not that this
   * guest's dates qualify for it.
   */
  applicableGraceHours: number | null;
};

/**
 * TASK-7012: never render "Free cancellation until \<past date\>" as a benefit. When the deadline has
 * already passed at booking time, replace it with accurate policy copy rather than a lapsed promise.
 *
 * The one case where `trustMessage` is null is a still-active grace window with a lapsed tier deadline:
 * there the caller's grace-window strip carries the (true) claim, so a second sentence would be
 * redundant. When grace is VOIDED we fall through to the standard-policy sentence instead — the guest
 * has no free cancellation left, and `applicableGraceHours` is null so the caller's grace strip stays
 * hidden too.
 */
/**
 * TASK-7432: homepage hero has no listing/check-in context, so it cannot invent 48h+24h badges.
 * When a default tier is known, return one short policy chip; otherwise omit (callers link to /policies).
 */
export function resolveHomepageCancellationChip(input: {
  tier: CancellationTier | string | null | undefined;
}): string | null {
  const tier = (input.tier ?? '').toString().trim();
  if (!tier) return null;
  // Single statement — never pair contradictory hour windows on the hero.
  return 'See cancellation policy';
}

export function resolveFreeCancellationTrustCopy(input: {
  checkInDate: Date;
  tier: CancellationTier | string | null | undefined;
  windowHoursOverride?: number | null;
  bookingCreatedAt?: Date;
  graceHours?: number | null;
  now?: Date;
}): FreeCancellationTrustCopy {
  const now = input.now ?? new Date();
  const bookingCreatedAt = input.bookingCreatedAt ?? now;
  const applicableGraceHours = resolveApplicableGraceHours(
    input.checkInDate,
    bookingCreatedAt,
    input.graceHours,
  );
  const deadline = computeEffectiveCancellationDeadline(
    input.checkInDate,
    input.tier,
    input.windowHoursOverride,
    bookingCreatedAt,
    applicableGraceHours,
  );

  if (isFreeCancellationDeadlineActive(deadline, now)) {
    const formatted = formatCancellationDeadline(deadline);
    return {
      trustMessage: `Free cancellation until ${formatted}`,
      deadlineFormatted: formatted,
      applicableGraceHours,
    };
  }

  if (applicableGraceHours != null) {
    return { trustMessage: null, deadlineFormatted: null, applicableGraceHours };
  }

  return {
    trustMessage: 'Standard cancellation policy applies for this stay.',
    deadlineFormatted: null,
    applicableGraceHours: null,
  };
}
