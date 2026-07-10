import { useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { GuestCounts } from '@/components/ui/GuestTypeSelector';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type RowProps = {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

function GuestRow({ label, sublabel, value, min, max, onChange, disabled }: RowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {sublabel && <p className="text-xs text-text-muted">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-medium">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => onChange(value + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type Props = {
  value: GuestCounts;
  onChange: (counts: GuestCounts) => void;
  maxCapacity?: number;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  summary: string;
};

export function AirbnbGuestSelector({
  value,
  onChange,
  maxCapacity = 20,
  isOpen,
  onToggle,
  onClose,
  summary,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const totalOccupancy = value.adults + value.children;
  const isAtCapacity = totalOccupancy >= maxCapacity;

  // TASK-4439: focus trap + focus return (WCAG 2.4.3 / 2.1.2)
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    // TASK-4439: Escape must close — with the focus trap active, click-outside
    // alone would leave keyboard users with no way to dismiss the popover.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Select guests"
        onClick={onToggle}
        className="mt-1 w-full text-left text-sm text-text-body"
        data-testid="airbnb-search-guests-trigger"
      >
        {summary}
      </button>
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Guest selector"
          className="absolute left-0 top-full z-50 mt-2 min-w-[300px] rounded-2xl border border-border bg-bg-surface p-4 shadow-lg"
        >
          <GuestRow
            label="Adults"
            sublabel="Ages 13+"
            value={value.adults}
            min={1}
            max={maxCapacity}
            onChange={(n) => {
              const adults = Math.max(1, Math.min(maxCapacity, n));
              const children = Math.min(value.children, maxCapacity - adults);
              onChange({ ...value, adults, children });
            }}
          />
          <GuestRow
            label="Children"
            sublabel="Ages 2–12"
            value={value.children}
            min={0}
            max={maxCapacity - value.adults}
            onChange={(n) => onChange({ ...value, children: Math.max(0, Math.min(maxCapacity - value.adults, n)) })}
            disabled={isAtCapacity}
          />
          <GuestRow
            label="Infants"
            sublabel="Under 2"
            value={value.infants}
            min={0}
            max={5}
            onChange={(n) => onChange({ ...value, infants: Math.max(0, Math.min(5, n)) })}
          />
          <GuestRow
            label="Pets"
            value={value.pets}
            min={0}
            max={5}
            onChange={(n) => onChange({ ...value, pets: Math.max(0, Math.min(5, n)) })}
          />
        </div>
      )}
    </div>
  );
}
