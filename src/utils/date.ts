import { DateTime } from 'luxon';

/**
 * TWO DATE BASES LIVE IN THIS APP. Mixing them is a shipped availability bug — read this
 * before touching any booking-date code.
 *
 * 1. INSTANT basis — a real point in time (e.g. `new Date()`, or `new Date('2026-08-20')`
 *    which parses as UTC midnight). Use `getIstStartOfDay` / `toISODate` (utils/dateRange)
 *    on these: they answer "which IST calendar day was this instant?".
 *
 * 2. CALENDAR basis — a *civil date* with no time-of-day meaning: "the night of 20 Aug".
 *    Represented as a LOCAL-midnight Date (`new Date(y, m, d)`), because that is what the
 *    booking calendar grid builds for each cell and what date-fns (`format`, `isSameDay`,
 *    `getDay`, `addDays`) reads. Key these with `toCalendarISO`, normalise with
 *    `startOfCalendarDay`, and get "today" from `getIstCalendarDate`.
 *
 * The trap: applying an instant→IST conversion to a CALENDAR-basis value. For a guest east
 * of UTC+05:30, local midnight of day D is still D-1 in IST, so `toISODate(getIstStartOfDay(cell))`
 * silently yields D-1 — the availability gate then evaluates a different night from the one
 * the guest sees and clicks. Zones at or west of +05:30 (incl. UTC and Asia/Kolkata) are
 * accidentally correct, which is why this cannot be caught by a suite that only runs there.
 */

/** INSTANT basis: the IST-midnight *instant* that starts the IST day containing `date`. */
export const getIstStartOfDay = (date: Date = new Date()) =>
  DateTime.fromJSDate(date).setZone('Asia/Kolkata').startOf('day').toJSDate();

/**
 * INSTANT → CALENDAR basis. Returns the IST civil date of `date` as a local-midnight Date.
 * This is the bridge to use at every boundary where an instant (now, a URL param, an API
 * date string) enters calendar-basis code — the property runs on IST, so the IST civil date
 * is the night being talked about regardless of the guest's browser zone.
 */
export const getIstCalendarDate = (date: Date = new Date()) => {
  const istDate = DateTime.fromJSDate(date).setZone('Asia/Kolkata');
  return new Date(istDate.year, istDate.month - 1, istDate.day);
};

/**
 * CALENDAR basis: normalise a calendar-basis Date to local midnight. Idempotent, and safe
 * across DST (it rebuilds from local Y/M/D rather than subtracting a fixed offset).
 */
export const startOfCalendarDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * CALENDAR → INSTANT basis. The IST-midnight instant of the civil date `date` denotes.
 * Use this whenever a calendar-basis date must leave the widget as an ISO instant string
 * (e.g. BookingContext's checkIn/checkOut wire format), so that reading it back through
 * `getIstCalendarDate` round-trips to the same civil date in every guest timezone.
 * A bare `.toISOString()` on a local-midnight Date does NOT round-trip east of UTC+05:30.
 */
export const istInstantFromCalendarDate = (date: Date): Date =>
  DateTime.fromObject(
    { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
    { zone: 'Asia/Kolkata' },
  ).toJSDate();

/**
 * CALENDAR basis → ISO key (YYYY-MM-DD). THE single calendar-cell→key helper: the booking
 * calendar and the booking widget must both route through this so the grid the guest sees
 * and the gate that decides bookability can never again key the same cell to different days.
 * Reads LOCAL components, because a calendar-basis Date carries its civil date there.
 */
export const toCalendarISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
