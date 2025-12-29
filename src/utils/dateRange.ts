import { addDays } from 'date-fns';
import { DateTime } from 'luxon';
import { type BookingDTO } from '@/types/booking';
import { getIstStartOfDay } from '@/utils/date';

/**
 * Convert a Date to ISO date string (YYYY-MM-DD) using IST date components.
 * This ensures the date doesn't shift when converting to UTC (important for IST timezone).
 * Since dates are normalized to IST, we extract the IST date components.
 */
export const toISODate = (date: Date): string => {
  // Convert to IST and extract date components to avoid timezone shifts
  const istDate = DateTime.fromJSDate(date).setZone('Asia/Kolkata');
  const year = istDate.year;
  const month = String(istDate.month).padStart(2, '0');
  const day = String(istDate.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseISODate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/**
 * Returns true if dateISO is within [startISO, endISOExclusive)
 */
export const isDateInRange = (dateISO: string, startISO: string, endISOExclusive: string): boolean => {
  return dateISO >= startISO && dateISO < endISOExclusive;
};

/**
 * Expand bookings into a Set of blocked ISO dates (checkOutDate is exclusive)
 */
export const expandBookingsToBlockedSet = (bookings: BookingDTO[]): Set<string> => {
  const blocked = new Set<string>();
  bookings.forEach((booking) => {
    // Parse and normalize to IST start of day for consistent date handling
    const start = getIstStartOfDay(parseISODate(booking.checkInDate));
    const end = getIstStartOfDay(parseISODate(booking.checkOutDate));
    // Start with normalized date
    let cursor = start;
    while (cursor < end) {
      // cursor is already normalized, convert to ISO string
      blocked.add(toISODate(cursor));
      // Increment and normalize to ensure consistent date handling across month boundaries
      cursor = getIstStartOfDay(addDays(cursor, 1));
    }
  });
  return blocked;
};

/**
 * Check if any date in [checkInISO, checkOutISO) intersects blocked set
 */
export const doesRangeIntersectBlocked = (checkInISO: string, checkOutISO: string, blocked: Set<string>): boolean => {
  // Normalize to IST start of day for consistent comparison
  let cursor = getIstStartOfDay(parseISODate(checkInISO));
  const end = getIstStartOfDay(parseISODate(checkOutISO));
  while (cursor < end) {
    if (blocked.has(toISODate(cursor))) return true;
    // Increment and normalize to ensure consistent date handling across month boundaries
    cursor = getIstStartOfDay(addDays(cursor, 1));
  }
  return false;
};

