// BookingCardGuestsSection.tsx
import React from 'react';
import { GuestCounts, GuestCountKey } from './BookingCard';

interface BookingCardGuestsSectionProps {
  openGuests: boolean;
  guestMenuRef: React.RefObject<HTMLDivElement>;
  guestMenuBooting: boolean;
  guests: GuestCounts;
  modifyGuest: (type: GuestCountKey, increment: boolean) => void;
  isAtMin: (type: GuestCountKey) => boolean;
  isAtMax: (type: GuestCountKey) => boolean;
  setGuests: React.Dispatch<React.SetStateAction<GuestCounts>>;
  guestLimits: Record<GuestCountKey, { min: number; max?: number }>;
  maxCapacity: number;
  extraGuestFee: number;
  totalGuests: number;
  updateChildAge: (index: number, age: number) => void;
  markEngagement: () => void;
  setOpenGuests: React.Dispatch<React.SetStateAction<boolean>>;
}

export const BookingCardGuestsSection: React.FC<BookingCardGuestsSectionProps> = ({
  openGuests,
  guestMenuRef,
  guestMenuBooting,
  guests,
  modifyGuest,
  isAtMin,
  isAtMax,
  setGuests,
  guestLimits,
  maxCapacity,
  extraGuestFee,
  totalGuests,
  updateChildAge,
  markEngagement,
  setOpenGuests,
}) => {
  const formattedExtraGuestFee = new Intl.NumberFormat('en-IN').format(extraGuestFee);
  const capacityTooltip =
    totalGuests >= maxCapacity
      ? `Maximum capacity: ${maxCapacity} guests. Extra guests ₹${formattedExtraGuestFee} per additional.`
      : undefined;

  const isAtCapacity = totalGuests >= maxCapacity;

  return (
    <>
      {openGuests && (
        <div
          ref={guestMenuRef}
          className="absolute left-1/2 -translate-x-1/2 bg-bg-surface z-[var(--z-overlay)] rounded-xl shadow-level2 border border-border-subtle p-4 overflow-y-auto"
          style={{
            width: '90%',
            maxHeight: '200px',
            top: '260px',
          }}
        >
          {guestMenuBooting ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 rounded-xl bg-[color:color-mix(in_srgb,var(--bg-muted)_70%,var(--bg-surface))] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-medium">Adults</p>
                    <p className="text-sm text-text-muted">Age 14 or above</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => modifyGuest('adults', false)}
                      disabled={isAtMin('adults')}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                    <span>{guests.adults}</span>
                    <button
                      onClick={() => modifyGuest('adults', true)}
                      disabled={isAtMax('adults')}
                      title={capacityTooltip}
                      aria-label={capacityTooltip}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-medium">Children</p>
                    <p className="text-sm text-text-muted">Ages 5-12</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isAtMin('children')) return;
                        setGuests((prev) => ({
                          ...prev,
                          children: Math.max(guestLimits.children.min, prev.children - 1),
                          childrenAges: prev.childrenAges.slice(0, -1),
                        }));
                      }}
                      disabled={isAtMin('children')}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                    <span>{guests.children}</span>
                    <button
                      onClick={() => {
                        if (isAtMax('children')) return;
                        setGuests((prev) => {
                          const nextChildren = prev.children + 1;
                          const cappedValue =
                            typeof guestLimits.children.max === 'number'
                              ? Math.min(guestLimits.children.max, nextChildren)
                              : nextChildren;
                          if (prev.adults + cappedValue + prev.infants > maxCapacity) {
                            return prev;
                          }
                          return {
                            ...prev,
                            children: cappedValue,
                            childrenAges: [...prev.childrenAges, 5],
                          };
                        });
                      }}
                      disabled={isAtMax('children')}
                      title={capacityTooltip}
                      aria-label={capacityTooltip}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                {guests.childrenAges.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {guests.childrenAges.map((age, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm">Child {index + 1}:</span>
                        <select
                          value={age}
                          onChange={(e) => updateChildAge(index, parseInt(e.target.value))}
                          className="border rounded p-1 text-sm w-20"
                        >
                          {[5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                            <option key={num} value={num}>
                              {num} years
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Infants</p>
                    <p className="text-sm text-text-muted">Under 5 years</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => modifyGuest('infants', false)}
                      disabled={isAtMin('infants')}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                    <span>{guests.infants}</span>
                    <button
                      onClick={() => modifyGuest('infants', true)}
                      disabled={isAtMax('infants')}
                      title={capacityTooltip}
                      aria-label={capacityTooltip}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
                {guests.infants > 0 && (
                  <p className="text-xs text-text-muted mt-1">
                    Maximum 2 infants allowed (0-4 years)
                  </p>
                )}
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-medium">Pets</p>
                    <p className="text-sm text-text-muted"></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => modifyGuest('pets', false)}
                      disabled={isAtMin('pets')}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                    <span>{guests.pets}</span>
                    <button
                      onClick={() => modifyGuest('pets', true)}
                      disabled={isAtMax('pets')}
                      className="w-11 h-11 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {isAtCapacity && (
                <p className="text-xs font-semibold text-cta-primary mt-2">
                  Maximum capacity: {maxCapacity} guests. Extra guest fee: ₹{formattedExtraGuestFee} per additional guest.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default BookingCardGuestsSection;
