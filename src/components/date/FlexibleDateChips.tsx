import React from "react";

export type DateFlexibilityMode = "exact" | "plus_minus_1" | "plus_minus_3" | "any_weekend";

export interface FlexibleDateOption {
  value: DateFlexibilityMode;
  label: string;
  shortLabel: string;
}

export const FLEXIBLE_DATE_OPTIONS: readonly FlexibleDateOption[] = [
  { value: "exact", label: "Exact dates", shortLabel: "Exact dates" },
  { value: "plus_minus_1", label: "±1 day", shortLabel: "±1 day" },
  { value: "plus_minus_3", label: "±3 days", shortLabel: "±3 days" },
  { value: "any_weekend", label: "Any weekend (this/next month)", shortLabel: "Any weekend" },
] as const;

export interface FlexibleAvailabilityMatch {
  listingId: number;
  checkIn: string;
  checkOut: string;
  allInTotal?: number | null;
  currency?: string | null;
  nights?: number | null;
}

export function formatShortDateWindow(checkInIso: string, checkOutIso: string): string {
  const start = new Date(`${checkInIso.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${checkOutIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${checkInIso} – ${checkOutIso}`;
  }
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  if (sameMonth) {
    return `${startDay}–${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

export interface FlexibleDateChipsProps {
  value: DateFlexibilityMode;
  onChange: (mode: DateFlexibilityMode) => void;
  compact?: boolean;
  testIdPrefix?: string;
  className?: string;
}

export const FlexibleDateChips: React.FC<FlexibleDateChipsProps> = ({
  value,
  onChange,
  compact = false,
  testIdPrefix = "flex-date",
  className = "",
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Date flexibility"
      data-testid={`${testIdPrefix}-group`}
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
    >
      {FLEXIBLE_DATE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testIdPrefix}-chip-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] rounded-full px-3.5 py-2 text-xs font-semibold transition border ${
              active
                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                : "bg-bg-surface text-text-primary border-border-subtle hover:border-brand-primary/60"
            }`}
          >
            {compact ? opt.shortLabel : opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default FlexibleDateChips;
