/**
 * TASK-1687: Compact currency selector dropdown for the Navbar.
 * Display-only — Razorpay payments always charge in INR.
 */

import React from 'react';
import { useCurrency, type SupportedCurrency } from '../contexts/CurrencyContext';
import { SUPPORTED_CURRENCIES } from '../contexts/currencyConstants';

const CurrencySelector: React.FC = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      aria-label="Display currency"
      value={currency}
      onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
      className="rounded bg-transparent px-1.5 py-0.5 text-xs text-text-muted hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-cta-primary cursor-pointer"
      title="Choose display currency (display only — payments are in INR)"
    >
      {SUPPORTED_CURRENCIES.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};

export default CurrencySelector;
