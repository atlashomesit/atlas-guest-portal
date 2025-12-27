const isValidDate = (date: Date) => Number.isFinite(date.getTime());

const isExactIsoDate = (value: string, date: Date): boolean => {
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(value)) return true;

  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day &&
    isValidDate(date)
  );
};

export const parseDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;

  const candidate = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!isValidDate(candidate)) return null;

  if (typeof value === 'string' && !isExactIsoDate(value, candidate)) {
    return null;
  }

  return candidate;
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
