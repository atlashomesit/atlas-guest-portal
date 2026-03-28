export type AvailabilityWidgetMode = 'search' | 'unit';

export type BookingWindow = {
  checkinDate: string;
  checkoutDate: string;
};

const startOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const computeBlockedDates = (
  bookings: BookingWindow[],
  todayInput: Date = new Date(),
): Date[] => {
  const today = startOfDay(todayInput);
  const blockedDates: number[] = [];

  bookings.forEach((booking) => {
    const checkin = startOfDay(new Date(booking.checkinDate));
    const checkout = startOfDay(new Date(booking.checkoutDate));

    if (Number.isNaN(checkin.getTime()) || Number.isNaN(checkout.getTime())) return;
    if (checkout <= today) return;

    const rangeStart = checkin < today ? today : checkin;
    let cursor = new Date(rangeStart);

    while (cursor < checkout) {
      blockedDates.push(cursor.getTime());
      cursor = startOfDay(new Date(cursor.setDate(cursor.getDate() + 1)));
    }
  });

  return Array.from(new Set(blockedDates))
    .map((timestamp) => new Date(timestamp))
    .sort((a, b) => a.getTime() - b.getTime());
};
