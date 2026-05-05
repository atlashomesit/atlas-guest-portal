import React, { useEffect, useRef } from 'react';
import { Users, ChevronDown, Minus, Plus, Info } from 'lucide-react';

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

interface GuestTypeSelectorProps {
  value: GuestCounts;
  onChange: (counts: GuestCounts) => void;
  maxCapacity?: number;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface GuestTypeRowProps {
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  info?: string;
}

const GuestTypeRow: React.FC<GuestTypeRowProps> = ({
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
  disabled = false,
  info,
}) => {
  const isAtMin = value <= min;
  const isAtMax = max !== undefined && value >= max;

  return (
    <div className="flex items-center justify-between py-3 border-b-subtle)] last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
          {info && (
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-[var(--text-muted)] cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-transparent border-subtle)] rounded-lg shadow-[var(--shadow-level-2)] text-xs text-[var(--text-muted)] z-50">
                {info}
              </div>
            </div>
          )}
        </div>
        {sublabel && <span className="text-xs text-[var(--text-muted)]">{sublabel}</span>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={isAtMin || disabled}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border-subtle)] text-[var(--text-primary)] transition-all hover:border-[var(--cta-primary)] hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-transparent"
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2ch] text-center text-sm font-medium text-[var(--text-primary)]">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={isAtMax || disabled}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border-subtle)] text-[var(--text-primary)] transition-all hover:border-[var(--cta-primary)] hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-transparent"
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const GuestTypeSelector: React.FC<GuestTypeSelectorProps> = ({
  value,
  onChange,
  maxCapacity = 20,
  isOpen,
  onToggle,
  onClose,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate total occupancy (adults + children, excluding infants)
  const totalOccupancy = value.adults + value.children;
  
  // Summary display
  const guestCount = totalOccupancy;
  const parts: string[] = [];
  
  if (guestCount > 0) {
    parts.push(`${guestCount} guest${guestCount !== 1 ? 's' : ''}`);
  }
  if (value.infants > 0) {
    parts.push(`${value.infants} infant${value.infants !== 1 ? 's' : ''}`);
  }
  if (value.pets > 0) {
    parts.push(`${value.pets} pet${value.pets !== 1 ? 's' : ''}`);
  }
  
  const summary = parts.length > 0 ? parts.join(', ') : 'Add guests';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleAdultsChange = (n: number) => {
    const newAdults = Math.max(1, Math.min(maxCapacity, n));
    const newChildren = Math.min(value.children, maxCapacity - newAdults);
    onChange({ ...value, adults: newAdults, children: newChildren });
  };

  const handleChildrenChange = (n: number) => {
    const maxChildren = maxCapacity - value.adults;
    const newChildren = Math.max(0, Math.min(maxChildren, n));
    onChange({ ...value, children: newChildren });
  };

  const handleInfantsChange = (n: number) => {
    onChange({ ...value, infants: Math.max(0, n) });
  };

  const handlePetsChange = (n: number) => {
    onChange({ ...value, pets: Math.max(0, n) });
  };

  const isAtCapacity = totalOccupancy >= maxCapacity;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={onToggle}
        className="field-card flex h-full min-h-[120px] flex-col justify-between rounded-2xl border-subtle)] bg-transparent px-7 py-7 shadow-[var(--shadow-level-1)] hover:shadow-[var(--shadow-level-2)] hover:scale-[1.01] text-left w-full transition-all
        aria-expanded={isOpen}
        aria-label="Select guests"
      >
        <span className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--text-muted)] whitespace-nowrap">
          <Users className="h-[18px] w-[18px] shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="truncate">Guests</span>
        </span>
        <span className="guest-value mt-4 flex items-center justify-between gap-2 text-[22px] font-medium text-[var(--text-primary)] leading-tight">
          {summary}
          <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
        </span>
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Maximum {maxCapacity} guests
        </p>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-transparent rounded-xl shadow-[var(--shadow-level-3)] border-subtle)] p-5 z-50 min-w-[320px]">
          <div className="flex flex-col">
            <GuestTypeRow
              label="Adults"
              sublabel="Ages 13+"
              value={value.adults}
              min={1}
              max={maxCapacity}
              onChange={handleAdultsChange}
              disabled={false}
            />
            
            <GuestTypeRow
              label="Children"
              sublabel="Ages 2-12"
              value={value.children}
              min={0}
              max={maxCapacity - value.adults}
              onChange={handleChildrenChange}
              disabled={isAtCapacity}
            />
            
            <GuestTypeRow
              label="Infants"
              sublabel="Under 2"
              value={value.infants}
              min={0}
              onChange={handleInfantsChange}
              info="Infants don't count toward occupancy limit"
            />
            
            <GuestTypeRow
              label="Pets"
              value={value.pets}
              min={0}
              onChange={handlePetsChange}
              info="Service animals always welcome"
            />
          </div>
          
          {isAtCapacity && (
            <div className="mt-3 pt-3 border-t-subtle)]">
              <p className="text-xs text-[var(--support-error)] font-medium">
                Maximum capacity reached ({maxCapacity} guests)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

