import type { SupportedCurrency } from './CurrencyContext';

export const SUPPORTED_CURRENCIES: Array<{ value: SupportedCurrency; label: string }> = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AUD', label: 'A$ AUD' },
  { value: 'SGD', label: 'S$ SGD' },
];

export const DEFAULT_CURRENCY: SupportedCurrency = 'INR';
