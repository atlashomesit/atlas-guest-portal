/**
 * TASK-102389 — cross-year date-range validation.
 *
 * Board-reported defect: range logic comparing `checkOut.getMonth() >= checkIn.getMonth()`
 * without the year component locks the picker for stays spanning New Year (e.g. Dec 28 → Jan 3).
 *
 * Source verification 2026-09-23: no `getMonth()`-only range comparison exists in this repo —
 * `AtlasDateRangePicker.validateDateRange` already compares full instants (`checkOut <= checkIn`)
 * plus `differenceInCalendarDays`. This helper pins the board's required semantics
 * (full UTC timestamp comparison) in one place so the invariant cannot regress, and both the
 * picker and any future caller share it.
 */

export function isCheckoutAfterCheckin(checkIn: Date | null, checkOut: Date | null): boolean {
  if (!checkIn || !checkOut) return false;
  // Full UTC timestamp comparison — never Y/M/D components in isolation, so a checkout in
  // January of year Y+1 correctly compares greater than a check-in in December of year Y.
  return checkOut.getTime() > checkIn.getTime();
}

export function validateStayRange(checkIn: Date | null, checkOut: Date | null): {
  valid: boolean;
  error: string | null;
} {
  if (!checkIn || !checkOut) return { valid: true, error: null };
  if (!isCheckoutAfterCheckin(checkIn, checkOut)) {
    return { valid: false, error: 'Check-out date must be after check-in date' };
  }
  return { valid: true, error: null };
}
