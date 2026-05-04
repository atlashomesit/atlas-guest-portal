/**
 * TASK-1687: Guest portal multi-currency display preference.
 *
 * Currency selector is for display only — all Razorpay payments are processed in INR.
 * FX rates are fetched from Frankfurter API, cached 12h in localStorage.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const LS_CURRENCY_KEY = 'atlas_display_currency';
const LS_FX_CACHE_KEY = 'atlas_fx_rates_cache';
const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'SGD';

interface FxCache {
  base: 'INR';
  rates: Record<string, number>;
  fetchedAt: number;
}

interface CurrencyContextValue {
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  /** Convert an INR amount to the selected display currency. Returns INR amount unchanged if rate unknown. */
  convert: (inrAmount: number) => number;
  /** Format an INR amount in the selected display currency. Shows "≈" prefix for non-INR. */
  format: (inrAmount: number) => string;
  /** The exact INR display (e.g. "₹5,000"). Useful for the "(₹X on payment)" note. */
  formatINR: (inrAmount: number) => string;
  isConverted: boolean; // true when currency !== 'INR'
  rates: Record<string, number>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const INTL_LOCALES: Record<SupportedCurrency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AUD: 'en-AU',
  SGD: 'en-SG',
};

function loadCachedRates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_FX_CACHE_KEY);
    if (!raw) return {};
    const cache: FxCache = JSON.parse(raw) as FxCache;
    if (Date.now() - cache.fetchedAt > FX_CACHE_TTL_MS) return {};
    return cache.rates ?? {};
  } catch {
    return {};
  }
}

function saveCachedRates(rates: Record<string, number>) {
  const cache: FxCache = { base: 'INR', rates, fetchedAt: Date.now() };
  try {
    localStorage.setItem(LS_FX_CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — skip */ }
}

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(() => {
    const stored = localStorage.getItem(LS_CURRENCY_KEY);
    return (stored as SupportedCurrency) ?? 'INR';
  });
  const [rates, setRates] = useState<Record<string, number>>(() => loadCachedRates());

  // Fetch FX rates from Frankfurter when currency is not INR and rates are stale/missing
  useEffect(() => {
    if (currency === 'INR') return;
    const cached = loadCachedRates();
    if (cached[currency]) {
      setRates(cached);
      return;
    }
    fetch('https://api.frankfurter.app/latest?from=INR')
      .then((r) => r.json() as Promise<{ rates: Record<string, number> }>)
      .then(({ rates: fresh }) => {
        setRates(fresh);
        saveCachedRates(fresh);
      })
      .catch(() => { /* keep current rates on network failure */ });
  }, [currency]);

  const setCurrency = useCallback((c: SupportedCurrency) => {
    setCurrencyState(c);
    try { localStorage.setItem(LS_CURRENCY_KEY, c); } catch { /* ignore */ }
  }, []);

  const convert = useCallback(
    (inrAmount: number): number => {
      if (currency === 'INR') return inrAmount;
      const rate = rates[currency];
      if (!rate) return inrAmount;
      return inrAmount * rate;
    },
    [currency, rates],
  );

  const formatINR = useCallback(
    (inrAmount: number): string =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(inrAmount),
    [],
  );

  const format = useCallback(
    (inrAmount: number): string => {
      if (currency === 'INR') return formatINR(inrAmount);
      const rate = rates[currency];
      if (!rate) return formatINR(inrAmount); // fall back if rate not loaded yet
      const converted = inrAmount * rate;
      const locale = INTL_LOCALES[currency] ?? 'en-US';
      const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(converted);
      return `≈ ${formatted}`;
    },
    [currency, rates, formatINR],
  );

  const isConverted = currency !== 'INR';

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, format, formatINR, isConverted, rates }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
