import { differenceInCalendarDays } from 'date-fns';

/**
 * Calculate the number of nights between check-in and check-out dates
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights (checkout date is NOT counted as a night)
 */
export const calculateNights = (checkIn: Date | null, checkOut: Date | null): number => {
  if (!checkIn || !checkOut) return 0;
  // differenceInCalendarDays counts civil-day boundaries crossed, not elapsed milliseconds.
  // Callers pass local-midnight calendar dates, and in a guest timezone with DST a civil day
  // can be 23h or 25h long — the previous `Math.ceil(elapsed / 24h)` turned a single
  // fall-back-DST night into 2 nights (and thus 2 nights of fare).
  return Math.max(0, differenceInCalendarDays(checkOut, checkIn));
};

/**
 * Format night count for display
 * @param nights - Number of nights
 * @returns Formatted string like "2 nights" or "1 night"
 */
export const formatNightCount = (nights: number): string => {
  if (nights === 0) return '';
  return `${nights} night${nights === 1 ? '' : 's'}`;
};

/**
 * Format a date in the given IANA timezone (e.g. Asia/Kolkata) for display.
 * Falls back to local/intl if timezone is missing or invalid.
 */
export const formatDateInTimezone = (date: Date, timezoneId?: string): string => {
  const tz = timezoneId || 'Asia/Kolkata';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
};

/**
 * Format a date string (ISO) in a specific timezone using date-fns-like format.
 * Used for calendar per-night breakdown rows in booking widget.
 * @param isoDate - ISO date string (YYYY-MM-DD)
 * @param format - Format string ('EEE d MMM' → 'Mon 15 Jul')
 * @param timezoneId - IANA timezone (defaults to Asia/Kolkata)
 */
export const formatIsoDateInTimezone = (
  isoDate: string,
  format: string,
  timezoneId: string = 'Asia/Kolkata'
): string => {
  try {
    // Parse the ISO date as a Date object in UTC, then display in the target timezone
    const date = new Date(isoDate + 'T00:00:00Z');
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneId,
      weekday: format.includes('EEE') ? 'short' : undefined,
      day: format.includes('d') ? 'numeric' : undefined,
      month: format.includes('MMM') ? 'short' : undefined,
      year: format.includes('yyyy') ? 'numeric' : undefined,
    });
    const parts = formatter.formatToParts(date);
    
    // Reconstruct the formatted string based on the requested format
    if (format === 'EEE d MMM') {
      const weekday = parts.find(p => p.type === 'weekday')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      return `${weekday} ${day} ${month}`;
    }
    return date.toLocaleDateString();
  } catch {
    // Fallback to UTC parsing
    const date = new Date(isoDate + 'T00:00:00Z');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate();
    const month = monthNames[date.getUTCMonth()];
    const weekday = dayNames[date.getUTCDay()];
    return `${weekday} ${day} ${month}`;
  }
};

