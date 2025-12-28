import { addDays, addWeeks, startOfDay, startOfWeek, endOfWeek, isSameDay } from 'date-fns';

export interface DatePresetRange {
  start: Date;
  end: Date;
}

export const getNextWeekendRange = (): DatePresetRange => {
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  
  // Calculate days until next Saturday (day 6)
  const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7 || 7;
  const saturday = addDays(today, daysUntilSaturday);
  const monday = addDays(saturday, 2); // Sat -> Mon (2 nights)
  
  return { start: saturday, end: monday };
};

export const getNextWeekRange = (): DatePresetRange => {
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  
  // Calculate days until next Monday (day 1)
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (1 - dayOfWeek + 7) % 7 || 7;
  const monday = addDays(today, daysUntilMonday);
  const sunday = addDays(monday, 6); // Full week
  
  return { start: monday, end: sunday };
};

export const get7NightsRange = (startDate?: Date): DatePresetRange => {
  const start = startDate ? startOfDay(startDate) : startOfDay(new Date());
  const end = addDays(start, 7);
  return { start, end };
};

export const get14NightsRange = (startDate?: Date): DatePresetRange => {
  const start = startDate ? startOfDay(startDate) : startOfDay(new Date());
  const end = addDays(start, 14);
  return { start, end };
};

export const isRangeUnavailable = (
  range: DatePresetRange,
  disabledDay?: (date: Date) => boolean,
): boolean => {
  if (!disabledDay) return false;
  
  let current = range.start;
  while (current <= range.end) {
    if (disabledDay(current)) return true;
    current = addDays(current, 1);
  }
  return false;
};

export const isCurrentRange = (
  presetRange: DatePresetRange,
  currentRange?: { startDate: Date | null; endDate: Date | null },
): boolean => {
  if (!currentRange?.startDate || !currentRange?.endDate) return false;
  
  return (
    isSameDay(presetRange.start, currentRange.startDate) &&
    isSameDay(presetRange.end, currentRange.endDate)
  );
};

