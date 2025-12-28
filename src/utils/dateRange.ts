import { addDays } from 'date-fns';
import { type BookingDTO } from '@/types/booking';

export const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

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
    const start = parseISODate(booking.checkInDate);
    const end = parseISODate(booking.checkOutDate);
    let cursor = start;
    while (cursor < end) {
      blocked.add(toISODate(cursor));
      cursor = addDays(cursor, 1);
    }
  });
  return blocked;
};

/**
 * Check if any date in [checkInISO, checkOutISO) intersects blocked set
 */
export const doesRangeIntersectBlocked = (checkInISO: string, checkOutISO: string, blocked: Set<string>): boolean => {
  let cursor = parseISODate(checkInISO);
  const end = parseISODate(checkOutISO);
  while (cursor < end) {
    if (blocked.has(toISODate(cursor))) return true;
    cursor = addDays(cursor, 1);
  }
  return false;
};

