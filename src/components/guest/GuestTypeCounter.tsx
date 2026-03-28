import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface GuestTypeCounterProps {
  label: string;
  subtitle?: string;
  helperText?: string;
  value: number;
  min: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export const GuestTypeCounter: React.FC<GuestTypeCounterProps> = ({
  label,
  subtitle,
  helperText,
  value,
  min,
  max,
  onIncrement,
  onDecrement,
  disabled = false,
}) => {
  const canDecrement = value > min && !disabled;
  const canIncrement = value < max && !disabled;

  return (
    <div className="flex items-center justify-between py-4 border-b border-border-subtle last:border-b-0">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-text-primary">{label}</span>
          {subtitle && (
            <span className="text-sm text-text-muted">{subtitle}</span>
          )}
        </div>
        {helperText && (
          <p className="mt-1 text-xs text-text-muted">{helperText}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          disabled={!canDecrement}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-text-primary transition hover:border-cta-primary hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-subtle disabled:hover:bg-bg-surface"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2ch] text-center text-base font-semibold text-text-primary">
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={!canIncrement}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-text-primary transition hover:border-cta-primary hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-subtle disabled:hover:bg-bg-surface"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

