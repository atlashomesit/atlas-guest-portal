import { addDays, addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';
import { type BookingDTO } from '@/types/booking';
import { toISODate } from '@/utils/dateRange';

const cache = new Map<string, BookingDTO[]>();

// Simple deterministic RNG (mulberry32) seeded from listingId hash
const hashString = (input: string): number => {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const createSeededRng = (seedString: string) => mulberry32(hashString(seedString));

type Range = { start: Date; end: Date };

const rangesOverlap = (a: Range, b: Range) => a.start < b.end && b.start < a.end;

/**
 * Generate mock bookings for multiple listings.
 * Ensures ~blockedRatio of days are covered in next monthsAhead months.
 */
export const generateMockBookings = (
  listingIds: string[],
  start: Date,
  monthsAhead = 2,
  blockedRatio = 0.2,
): BookingDTO[] => {
  const windowStart = startOfDay(start);
  const windowEnd = startOfDay(addMonths(windowStart, monthsAhead));

  const bookings: BookingDTO[] = [];

  listingIds.forEach((listingId) => {
    const rng = createSeededRng(listingId);
    const totalDays = Math.max(1, differenceInCalendarDays(windowEnd, windowStart));
    const targetBlocked = Math.max(2, Math.floor(totalDays * blockedRatio));
    const minRanges = 2;
    const maxRanges = 6;
    const ranges: Range[] = [];

    const addRange = (candidate: Range) => {
      // Clamp to window
      if (candidate.start < windowStart || candidate.end > windowEnd || candidate.start >= candidate.end) return false;
      // No overlap with existing
      if (ranges.some((r) => rangesOverlap(r, candidate))) return false;
      ranges.push(candidate);
      return true;
    };

    // Try to build non-overlapping ranges
    const maxAttempts = 50;
    let attempts = 0;
    while (ranges.length < maxRanges && attempts < maxAttempts) {
      attempts += 1;
      const startOffset = Math.floor(rng() * totalDays);
      const length = 2 + Math.floor(rng() * 5); // 2-6 nights
      const startDate = addDays(windowStart, startOffset);
      let endDate = addDays(startDate, length);
      if (endDate > windowEnd) endDate = windowEnd;

      if (addRange({ start: startDate, end: endDate })) {
        // Check if we already reached target blocked proportion
        const blockedCount = ranges.reduce(
          (acc, r) => acc + Math.max(0, differenceInCalendarDays(r.end, r.start)),
          0,
        );
        if (blockedCount >= targetBlocked && ranges.length >= minRanges) break;
      }
    }

    ranges.forEach((range, idx) => {
      bookings.push({
        id: `mock-${listingId}-${idx + 1}`,
        listingId: String(listingId),
        checkInDate: toISODate(range.start),
        checkOutDate: toISODate(range.end),
        status: 'confirmed',
        source: 'mock',
      });
    });
  });

  return bookings;
};

/**
 * Get deterministic mock bookings for a listing.
 */
export const getMockBookingsForListing = async (listingId: string): Promise<BookingDTO[]> => {
  if (!listingId) return [];
  if (cache.has(listingId)) return cache.get(listingId)!;

  const today = startOfDay(new Date());
  const bookings = generateMockBookings([listingId], today);
  cache.set(listingId, bookings);
  return bookings;
};

