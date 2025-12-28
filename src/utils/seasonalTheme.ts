import type { ThemeName } from '../styles/theme';

interface SeasonalPeriod {
  theme: ThemeName;
  startMonth: number;  // 1-12
  startDay: number;    // 1-31
  endMonth: number;
  endDay: number;
}

const SEASONAL_PERIODS: SeasonalPeriod[] = [
  {
    theme: 'valentine',
    startMonth: 2,   // February 1
    startDay: 1,
    endMonth: 2,     // February 14
    endDay: 14,
  },
  {
    theme: 'christmas',
    startMonth: 12,  // December 15
    startDay: 15,
    endMonth: 12,    // December 26
    endDay: 26,
  },
  {
    theme: 'newYear',
    startMonth: 12,  // December 27
    startDay: 27,
    endMonth: 1,     // January 2
    endDay: 2,
  },
];

function isDateInRange(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): boolean {
  const month = date.getMonth() + 1; // 0-indexed to 1-indexed
  const day = date.getDate();
  
  // Handle year-crossing ranges (e.g., Dec 27 - Jan 2)
  if (startMonth > endMonth) {
    return (
      (month === startMonth && day >= startDay) ||
      (month === endMonth && day <= endDay) ||
      (month > startMonth || month < endMonth)
    );
  }
  
  // Same month range
  if (startMonth === endMonth) {
    return month === startMonth && day >= startDay && day <= endDay;
  }
  
  // Multi-month range
  return (
    (month === startMonth && day >= startDay) ||
    (month === endMonth && day <= endDay) ||
    (month > startMonth && month < endMonth)
  );
}

export function getSeasonalTheme(date: Date = new Date()): ThemeName | null {
  for (const period of SEASONAL_PERIODS) {
    if (isDateInRange(date, period.startMonth, period.startDay, period.endMonth, period.endDay)) {
      return period.theme;
    }
  }
  return null; // Use default theme
}

export function getAutoTheme(): ThemeName {
  return getSeasonalTheme() || 'default';
}

