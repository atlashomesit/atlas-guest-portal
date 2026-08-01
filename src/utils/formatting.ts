const isValidDate = (date: Date) => Number.isFinite(date.getTime());

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TASK-6061: a bare `YYYY-MM-DD` (a booking's check-in/check-out) is a *calendar date*, not an
 * instant — Atlas's operational day is IST, and the same date-only value must render as the same
 * day for every viewer regardless of their browser's time zone. `new Date("2026-08-03")` parses
 * as UTC midnight per the ECMAScript spec; every consumer that then reads it back with LOCAL
 * getters (`getDate()`/`getMonth()`/`getFullYear()`) or formats via `toLocaleDateString` with no
 * explicit `timeZone` silently shifts the calendar day backward for any viewer west of UTC (e.g.
 * `2026-08-03` rendered as `02 Aug 2026` in `America/Los_Angeles`) — this is what put a wrong
 * check-in date on the pre-payment Reserve screen.
 *
 * Fix: construct date-only values with the LOCAL Date constructor instead. The Date's local
 * representation then already IS the intended calendar day, so every existing local-getter/
 * `toLocaleDateString`-based consumer (this file's own `formatDateForDisplay`/`formatHumanDate`,
 * and any other caller of `parseDate`) renders correctly with no further changes, in every time
 * zone — construction and read-back happen in the same local zone, so they can never disagree.
 */
const parseDateOnly = (value: string): Date | null => {
  const [year, month, day] = value.split('-').map(Number);
  const local = new Date(year, month - 1, day);
  const isValidCalendarDate =
    local.getFullYear() === year && local.getMonth() === month - 1 && local.getDate() === day;
  return isValidCalendarDate ? local : null;
};

export const parseDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    return parseDateOnly(value);
  }

  // Anything else (a full ISO datetime, a Date instance, ...) already carries explicit time/zone
  // information, so native parsing is fine as-is — this whole-day ambiguity only exists for a
  // bare date.
  const candidate = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return isValidDate(candidate) ? candidate : null;
};

export const formatDateForInput = (date: Date): string => {
  if (!isValidDate(date)) throw new Error('Cannot format invalid date');

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const formatDateForDisplay = (
  value: string | Date,
  fallback = 'Invalid date',
): string => {
  const date = parseDate(value);
  if (!date) return fallback;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

export const formatHumanDate = (
  value: string | Date | null | undefined,
  {
    locale = 'en-IN',
    fallback = 'Not selected',
    options = { day: '2-digit', month: 'short', year: 'numeric' } as Intl.DateTimeFormatOptions,
  } = {},
): string => {
  const date = parseDate(value);
  if (!date) return fallback;

  return date.toLocaleDateString(locale, options);
};

/**
 * Guest/marketing display of money (rounded for readability).
 * Tax invoices and GST line items use server-side rounding — do not rely on this for compliance totals.
 */
export const formatCurrency = (
  amount: number,
  {
    locale = 'en-IN',
    currency = 'INR',
    maximumFractionDigits = 0,
  }: { locale?: string; currency?: string; maximumFractionDigits?: number } = {},
): string => {
  if (!Number.isFinite(amount)) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits }).format(0);
  }

  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits }).format(amount);
};
