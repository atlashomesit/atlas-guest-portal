import React from 'react';

export interface PerMorningBreakfastConfig {
  mornings: string[]; // ISO dates e.g. ['2026-12-02', '2026-12-03']
  adults: number;
  children: number;
  adultPriceInr: number;
  childPriceInr: number;
}

export function calculatePerMorningBreakfastTotal(
  selectedMornings: string[],
  adults: number,
  children: number,
  adultPriceInr: number,
  childPriceInr: number
): number {
  const perMorning = Math.max(0, adults) * adultPriceInr + Math.max(0, children) * childPriceInr;
  return selectedMornings.length * perMorning;
}

export interface PerMorningBreakfastSelectorProps extends PerMorningBreakfastConfig {
  selectedMornings: string[];
  onChange: (nextSelected: string[]) => void;
}

export const PerMorningBreakfastSelector: React.FC<PerMorningBreakfastSelectorProps> = ({
  mornings,
  adults,
  children,
  adultPriceInr,
  childPriceInr,
  selectedMornings,
  onChange,
}) => {
  const toggleMorning = (date: string) => {
    if (selectedMornings.includes(date)) {
      onChange(selectedMornings.filter((d) => d !== date));
    } else {
      onChange([...selectedMornings, date]);
    }
  };

  const total = calculatePerMorningBreakfastTotal(
    selectedMornings,
    adults,
    children,
    adultPriceInr,
    childPriceInr
  );

  return (
    <div data-testid="per-morning-breakfast-selector" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Add home-cooked breakfast by morning</h4>
        <span className="text-xs text-slate-600">
          Adult ₹{adultPriceInr} · Child ₹{childPriceInr} / morning
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {mornings.map((m) => {
          const active = selectedMornings.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => toggleMorning(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                active
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-900" data-testid="breakfast-total">
        Breakfast add-on total: ₹{total}
      </p>
    </div>
  );
};
