import { addDays, addMonths, startOfMonth, endOfMonth } from 'date-fns';

export type KeyboardNavigationKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End'
  | 'Enter'
  | ' '
  | 'Escape';

export interface KeyboardNavigationResult {
  newFocusedDate?: Date;
  shouldSelect?: boolean;
  shouldClose?: boolean;
}

export const handleDateKeyboardNavigation = (
  key: string,
  focusedDate: Date | null,
  minDate?: Date,
  maxDate?: Date,
  disabledDay?: (date: Date) => boolean,
): KeyboardNavigationResult => {
  if (!focusedDate) return {};

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    if (disabledDay && disabledDay(date)) return true;
    return false;
  };

  const findNextEnabledDate = (startDate: Date, step: number): Date | undefined => {
    let candidate = startDate;
    let attempts = 0;
    const maxAttempts = 365; // Prevent infinite loops

    while (attempts < maxAttempts) {
      if (!isDateDisabled(candidate)) {
        return candidate;
      }
      candidate = addDays(candidate, step);
      attempts++;
    }
    return undefined;
  };

  switch (key as KeyboardNavigationKey) {
    case 'ArrowLeft': {
      const targetDate = addDays(focusedDate, -1);
      const enabledDate = findNextEnabledDate(targetDate, -1);
      return { newFocusedDate: enabledDate };
    }

    case 'ArrowRight': {
      const targetDate = addDays(focusedDate, 1);
      const enabledDate = findNextEnabledDate(targetDate, 1);
      return { newFocusedDate: enabledDate };
    }

    case 'ArrowUp': {
      const targetDate = addDays(focusedDate, -7);
      const enabledDate = findNextEnabledDate(targetDate, -7);
      return { newFocusedDate: enabledDate };
    }

    case 'ArrowDown': {
      const targetDate = addDays(focusedDate, 7);
      const enabledDate = findNextEnabledDate(targetDate, 7);
      return { newFocusedDate: enabledDate };
    }

    case 'PageUp': {
      const targetDate = addMonths(focusedDate, -1);
      const enabledDate = findNextEnabledDate(targetDate, 1);
      return { newFocusedDate: enabledDate };
    }

    case 'PageDown': {
      const targetDate = addMonths(focusedDate, 1);
      const enabledDate = findNextEnabledDate(targetDate, 1);
      return { newFocusedDate: enabledDate };
    }

    case 'Home': {
      const targetDate = startOfMonth(focusedDate);
      const enabledDate = findNextEnabledDate(targetDate, 1);
      return { newFocusedDate: enabledDate };
    }

    case 'End': {
      const targetDate = endOfMonth(focusedDate);
      const enabledDate = findNextEnabledDate(targetDate, -1);
      return { newFocusedDate: enabledDate };
    }

    case 'Enter':
    case ' ':
      return { shouldSelect: true };

    case 'Escape':
      return { shouldClose: true };

    default:
      return {};
  }
};

