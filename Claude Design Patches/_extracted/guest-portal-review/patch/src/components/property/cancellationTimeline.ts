/**
 * Pure helper for the property page's cancellation timeline.
 *
 * Given a tier and the guest's check-in date, returns 4 timeline steps
 * (anchored to *their* dates, not a generic policy page).
 *
 * Used by TrustBand. No React, no DOM — easy to unit-test.
 */

export type CancellationTier = 'Flexible' | 'Moderate' | 'Strict';

export type RefundTone = 'good' | 'current' | 'mid' | 'late';

export interface RefundStep {
  range: string;
  label: string;
  detail: string;
  tone: RefundTone;
}

const SHORT_DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const FULL_DAY  = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtShortDay = (d: Date) => SHORT_DAY.format(d);
export const fmtFullDay  = (d: Date) => FULL_DAY.format(d);

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Number of days before check-in at which free cancellation expires
 * for each tier. Mirrors what the host UI in atlas-admin-portal exposes
 * when a host picks a tier (Bookings → Cancellation policy dropdown).
 */
export const FREE_CANCEL_DAYS_BEFORE: Record<CancellationTier, number> = {
  Flexible: 1,
  Moderate: 7,
  Strict:  14,
};

/**
 * Returns the calendar date free cancellation expires for the given check-in.
 * Returns `null` if no check-in selected (caller should render generic copy).
 */
export function freeCancelByDate(tier: CancellationTier, checkIn: Date | null): Date | null {
  if (!checkIn) return null;
  return addDays(checkIn, -FREE_CANCEL_DAYS_BEFORE[tier]);
}

/**
 * 4-step refund timeline, anchored to the guest's check-in date.
 * Returns generic copy if checkIn is null.
 */
export function cancellationTimeline(tier: CancellationTier, checkIn: Date | null): RefundStep[] {
  if (!checkIn) {
    // No dates picked — generic tier copy.
    if (tier === 'Flexible') return [
      { range: 'Up to 24h before check-in', label: 'Full refund',   detail: 'Cancel for any reason. 100% back to your original method.', tone: 'good' },
      { range: 'Within 24h of check-in',    label: '50% refund',    detail: 'Cancellations close to check-in.',                          tone: 'current' },
      { range: 'On check-in day',           label: 'First night kept', detail: 'Remaining nights refundable.',                            tone: 'mid' },
      { range: 'During stay',               label: 'Prorated',      detail: 'Cancel remaining nights; refund prorated.',                 tone: 'late' },
    ];
    if (tier === 'Moderate') return [
      { range: 'Up to 7 days before',     label: 'Full refund',   detail: 'Cancel up to 7 days before check-in.', tone: 'good' },
      { range: 'Within 7 days',           label: '50% refund',    detail: 'Closer to check-in.',                  tone: 'current' },
      { range: 'On check-in day',         label: 'First night kept', detail: 'Remaining nights refundable.',      tone: 'mid' },
      { range: 'During stay',             label: 'Prorated',      detail: 'Cancel remaining nights; refund prorated.', tone: 'late' },
    ];
    // Strict
    return [
      { range: 'Up to 14 days before', label: '50% refund',     detail: 'Only partial refund available.', tone: 'good' },
      { range: 'Within 14 days',       label: 'Non-refundable', detail: 'Booking value retained.',        tone: 'late' },
      { range: 'On check-in day',      label: 'Non-refundable', detail: 'Booking value retained.',        tone: 'late' },
      { range: 'During stay',          label: 'Non-refundable', detail: 'No mid-stay refund.',            tone: 'late' },
    ];
  }

  // Dates picked — anchor copy to the guest's specific dates.
  const freeBy = freeCancelByDate(tier, checkIn)!;

  if (tier === 'Flexible') return [
    { range: `Now → ${fmtShortDay(freeBy)}`,                        label: 'Full refund',      detail: 'Cancel for any reason. 100% back to your original method.', tone: 'good' },
    { range: `${fmtShortDay(freeBy)} → ${fmtShortDay(checkIn)}`,    label: '50% refund',       detail: 'Within 24 hours of check-in.',                              tone: 'current' },
    { range: `${fmtShortDay(checkIn)} (check-in)`,                  label: 'First night kept', detail: 'Remaining nights refundable.',                              tone: 'mid' },
    { range: 'During stay',                                          label: 'Prorated',         detail: 'Cancel remaining nights; refund prorated.',                 tone: 'late' },
  ];

  if (tier === 'Moderate') return [
    { range: `Now → ${fmtShortDay(freeBy)}`,                       label: 'Full refund',      detail: 'Cancel up to 7 days before check-in.', tone: 'good' },
    { range: `${fmtShortDay(freeBy)} → ${fmtShortDay(checkIn)}`,   label: '50% refund',       detail: 'Within 7 days of check-in.',           tone: 'current' },
    { range: `${fmtShortDay(checkIn)} (check-in)`,                 label: 'First night kept', detail: 'Remaining nights refundable.',         tone: 'mid' },
    { range: 'During stay',                                         label: 'Prorated',         detail: 'Cancel remaining nights; refund prorated.', tone: 'late' },
  ];

  // Strict
  return [
    { range: `Now → ${fmtShortDay(freeBy)}`,                        label: '50% refund',      detail: 'Cancel up to 14 days before check-in.', tone: 'good' },
    { range: `${fmtShortDay(freeBy)} → ${fmtShortDay(checkIn)}`,    label: 'Non-refundable',  detail: 'Within 14 days of check-in.',           tone: 'late' },
    { range: `${fmtShortDay(checkIn)} (check-in)`,                  label: 'Non-refundable',  detail: 'Booking value retained.',               tone: 'late' },
    { range: 'During stay',                                          label: 'Non-refundable',  detail: 'No mid-stay refund.',                   tone: 'late' },
  ];
}
