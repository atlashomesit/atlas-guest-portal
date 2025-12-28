/**
 * Calculate the number of nights between check-in and check-out dates
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights (checkout date is NOT counted as a night)
 */
export const calculateNights = (checkIn: Date | null, checkOut: Date | null): number => {
  if (!checkIn || !checkOut) return 0;
  const diffTime = checkOut.getTime() - checkIn.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
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

