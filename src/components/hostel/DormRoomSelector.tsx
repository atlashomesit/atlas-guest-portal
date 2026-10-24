import React from 'react';
import HostelDormBadge, { formatBedType } from './HostelDormBadge';
import { type DormGenderPolicy } from '@/utils/dormListing';

export interface DormBedOption {
  id: string | number;
  bedType: string; // e.g. "Lower Bunk", "Upper Bunk", "Single Bed"
  title?: string;
  pricePerBed?: number;
  currency?: string;
  availableBeds?: number;
  amenities?: string[];
}

export interface DormRoomSelectorProps {
  roomName?: string;
  dormGenderPolicy?: DormGenderPolicy | string | null;
  accommodationType?: string | null;
  bedOptions?: DormBedOption[];
  selectedBedId?: string | number | null;
  selectedBedsCount?: number;
  maxBedsSelectable?: number;
  onSelectBed?: (bedId: string | number) => void;
  onCountChange?: (count: number) => void;
  className?: string;
}

const DEFAULT_DORM_AMENITIES = [
  'Personal Locker',
  'Reading Light',
  'Power Socket',
  'Free WiFi',
  'Air Conditioning',
];

export const DormRoomSelector: React.FC<DormRoomSelectorProps> = ({
  roomName = 'Dormitory Room',
  dormGenderPolicy,
  accommodationType = 'HostelDorm',
  bedOptions = [
    { id: 'lower-bunk', bedType: 'Lower Bunk', availableBeds: 4 },
    { id: 'upper-bunk', bedType: 'Upper Bunk', availableBeds: 4 },
    { id: 'single-bed', bedType: 'Single Bed', availableBeds: 2 },
  ],
  selectedBedId,
  selectedBedsCount = 1,
  maxBedsSelectable = 8,
  onSelectBed,
  onCountChange,
  className = '',
}) => {
  const currentBedId = selectedBedId ?? (bedOptions[0]?.id || null);

  const handleDecrease = () => {
    if (onCountChange && selectedBedsCount > 1) {
      onCountChange(selectedBedsCount - 1);
    }
  };

  const handleIncrease = () => {
    if (onCountChange && selectedBedsCount < maxBedsSelectable) {
      onCountChange(selectedBedsCount + 1);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4 ${className}`}
      data-testid="dorm-room-selector"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900" data-testid="dorm-room-title">
            {roomName}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Select bed preference and quantity for your stay
          </p>
        </div>
        <HostelDormBadge
          accommodationType={accommodationType}
          genderPolicy={dormGenderPolicy}
        />
      </div>

      {/* Bed Type Selection Options */}
      <div className="space-y-3" role="radiogroup" aria-label="Bed type selection">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
          Choose Bed Type
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bedOptions.map((option) => {
            const isSelected = currentBedId === option.id;
            const formattedType = formatBedType(option.bedType);
            const isAvailable = option.availableBeds == null || option.availableBeds > 0;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!isAvailable}
                onClick={() => onSelectBed?.(option.id)}
                className={`relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/40'
                } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                data-testid={`dorm-bed-option-${option.id}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-semibold text-sm text-neutral-900"
                      data-testid="dorm-bed-type-label"
                    >
                      {formattedType}
                    </span>
                    {isSelected && (
                      <span className="flex h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" />
                    )}
                  </div>
                  {option.title && (
                    <span className="text-xs text-neutral-500 mt-0.5 block">{option.title}</span>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs">
                  {option.availableBeds != null && (
                    <span
                      className={`font-medium ${
                        option.availableBeds <= 2 ? 'text-amber-700' : 'text-neutral-500'
                      }`}
                      data-testid="dorm-bed-inventory"
                    >
                      {option.availableBeds > 0
                        ? `${option.availableBeds} bed${option.availableBeds === 1 ? '' : 's'} left`
                        : 'Sold out'}
                    </span>
                  )}
                  {option.pricePerBed != null && (
                    <span className="font-semibold text-neutral-900 ml-auto">
                      {option.currency || '₹'}{option.pricePerBed}
                      <span className="text-[10px] font-normal text-neutral-500">/night</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amenity tag alignment */}
      <div className="space-y-2 pt-2 border-t border-neutral-100" data-testid="dorm-amenity-tags">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 block">
          Dorm Amenities & Features
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {DEFAULT_DORM_AMENITIES.map((amenity) => (
            <span
              key={amenity}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100/90 border border-neutral-200/80 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-2xs"
            >
              <span className="text-indigo-600 text-xs" aria-hidden="true">✓</span>
              <span>{amenity}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Bed quantity stepper */}
      <div
        className="flex items-center justify-between pt-3 border-t border-neutral-100"
        data-testid="dorm-bed-stepper"
      >
        <div>
          <span className="text-sm font-medium text-neutral-900 block">Number of Beds</span>
          <span className="text-xs text-neutral-500">1 bed per guest</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Decrease bed count"
            disabled={selectedBedsCount <= 1}
            onClick={handleDecrease}
            data-testid="dorm-beds-decrease"
          >
            −
          </button>
          <span
            className="w-6 text-center text-sm font-bold text-neutral-900"
            data-testid="dorm-beds-selected-count"
          >
            {selectedBedsCount}
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Increase bed count"
            disabled={selectedBedsCount >= maxBedsSelectable}
            onClick={handleIncrease}
            data-testid="dorm-beds-increase"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default DormRoomSelector;
