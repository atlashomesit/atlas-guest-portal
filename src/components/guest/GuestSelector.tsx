import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users } from 'lucide-react';
import { GuestTypeCounter } from './GuestTypeCounter';

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

interface GuestSelectorProps {
  value: GuestCounts;
  onChange: (value: GuestCounts) => void;
  maxOccupancy: number;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  allowPets?: boolean;
}

export const GuestSelector: React.FC<GuestSelectorProps> = ({
  value,
  onChange,
  maxOccupancy,
  open,
  onClose,
  anchorRef,
  allowPets = true,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calculate total occupancy (adults + children, infants don't count)
  const totalOccupancy = value.adults + value.children;

  const handleIncrement = (type: keyof GuestCounts) => {
    const newValue = { ...value };
    
    if (type === 'adults' || type === 'children') {
      // Check occupancy limit
      if (totalOccupancy >= maxOccupancy) return;
    }
    
    newValue[type] = value[type] + 1;
    onChange(newValue);
  };

  const handleDecrement = (type: keyof GuestCounts) => {
    const newValue = { ...value };
    newValue[type] = Math.max(value[type] - 1, type === 'adults' ? 1 : 0);
    onChange(newValue);
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose, open]);

  // Position popover
  useEffect(() => {
    if (!open || !anchorRef.current || !popoverRef.current) return;

    const updatePosition = () => {
      if (!anchorRef.current || !popoverRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = anchorRect.bottom + window.scrollY + 8;
      let left = anchorRect.left + window.scrollX;

      // Adjust if would overflow right edge
      if (left + popoverRect.width > viewportWidth - 16) {
        left = viewportWidth - popoverRect.width - 16;
      }

      // Adjust if would overflow bottom edge
      if (anchorRect.bottom + popoverRect.height > viewportHeight - 16) {
        top = anchorRect.top + window.scrollY - popoverRect.height - 8;
      }

      popoverRef.current.style.top = `${top}px`;
      popoverRef.current.style.left = `${left}px`;
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Select guests"
      className="absolute z-[95] w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-border-subtle bg-bg-surface shadow-level2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-muted/60 px-4 py-3">
        <Users className="h-4 w-4 text-text-muted" />
        <p className="text-sm font-semibold text-text-primary">Guests</p>
      </div>

      <div className="px-4 py-2">
        <GuestTypeCounter
          label="Adults"
          subtitle="Age 13+"
          value={value.adults}
          min={1}
          max={maxOccupancy}
          onIncrement={() => handleIncrement('adults')}
          onDecrement={() => handleDecrement('adults')}
        />

        <GuestTypeCounter
          label="Children"
          subtitle="Age 2-12"
          value={value.children}
          min={0}
          max={Math.max(0, maxOccupancy - value.adults)}
          onIncrement={() => handleIncrement('children')}
          onDecrement={() => handleDecrement('children')}
        />

        <GuestTypeCounter
          label="Infants"
          subtitle="Under 2"
          helperText="Don't count toward occupancy"
          value={value.infants}
          min={0}
          max={5}
          onIncrement={() => handleIncrement('infants')}
          onDecrement={() => handleDecrement('infants')}
        />

        {allowPets && (
          <GuestTypeCounter
            label="Pets"
            helperText="Additional fees may apply"
            value={value.pets}
            min={0}
            max={3}
            onIncrement={() => handleIncrement('pets')}
            onDecrement={() => handleDecrement('pets')}
          />
        )}
      </div>

      {totalOccupancy >= maxOccupancy && (
        <div className="border-t border-border-subtle bg-bg-muted/40 px-4 py-3">
          <p className="text-xs text-text-muted">
            Maximum occupancy of {maxOccupancy} {maxOccupancy === 1 ? 'guest' : 'guests'} reached
          </p>
        </div>
      )}
    </div>,
    document.body,
  );
};

// Helper function to format guest counts for display
// eslint-disable-next-line react-refresh/only-export-components -- shared util, co-located for convenience
export const formatGuestCounts = (counts: GuestCounts): string => {
  const parts: string[] = [];
  
  if (counts.adults > 0) {
    parts.push(`${counts.adults} ${counts.adults === 1 ? 'adult' : 'adults'}`);
  }
  
  if (counts.children > 0) {
    parts.push(`${counts.children} ${counts.children === 1 ? 'child' : 'children'}`);
  }
  
  if (counts.infants > 0) {
    parts.push(`${counts.infants} ${counts.infants === 1 ? 'infant' : 'infants'}`);
  }
  
  if (counts.pets > 0) {
    parts.push(`${counts.pets} ${counts.pets === 1 ? 'pet' : 'pets'}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : '0 guests';
};

// Helper to get total guest count for simple display
// eslint-disable-next-line react-refresh/only-export-components -- shared util, co-located for convenience
export const getTotalGuestCount = (counts: GuestCounts): number => {
  return counts.adults + counts.children + counts.infants + counts.pets;
};

