import { DEFAULT_MARKETPLACE_AMENITY_PILLS, type AmenityFilterPillItem } from '@/utils/amenityFilters';

export type AmenityFilterPillsProps = {
  selectedAmenity: string | null;
  onSelectAmenity: (amenity: string | null) => void;
  pills?: AmenityFilterPillItem[];
  freeCancellation?: boolean;
  onToggleFreeCancellation?: () => void;
  breakfastIncluded?: boolean;
  onToggleBreakfastIncluded?: () => void;
  showTopHost?: boolean;
  topHost?: boolean;
  onToggleTopHost?: () => void;
  selfCheckIn?: boolean;
  onToggleSelfCheckIn?: () => void;
};

export default function AmenityFilterPills({
  selectedAmenity,
  onSelectAmenity,
  pills = DEFAULT_MARKETPLACE_AMENITY_PILLS,
  freeCancellation = false,
  onToggleFreeCancellation,
  breakfastIncluded = false,
  onToggleBreakfastIncluded,
  showTopHost = false,
  topHost = false,
  onToggleTopHost,
  selfCheckIn = false,
  onToggleSelfCheckIn,
}: AmenityFilterPillsProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="marketplace-amenities-pills">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">Amenities:</span>
      {showTopHost && onToggleTopHost && (
        <button
          type="button"
          data-testid="marketplace-filter-top-host"
          aria-pressed={topHost}
          className={`min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border flex items-center gap-1.5 ${
            topHost
              ? 'bg-amber-900 text-white border-amber-900'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-500'
          }`}
          onClick={onToggleTopHost}
        >
          <span aria-hidden="true">★</span>
          <span>Top hosts</span>
        </button>
      )}
      {onToggleFreeCancellation && (
        <button
          type="button"
          data-testid="marketplace-filter-free-cancellation"
          aria-pressed={freeCancellation}
          className={`min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border flex items-center gap-1.5 ${
            freeCancellation
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
          }`}
          onClick={onToggleFreeCancellation}
        >
          <span aria-hidden="true">✓</span>
          <span>Free cancellation</span>
        </button>
      )}
      {onToggleBreakfastIncluded && (
        <button
          type="button"
          data-testid="marketplace-filter-breakfast"
          aria-pressed={breakfastIncluded}
          className={`min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border flex items-center gap-1.5 ${
            breakfastIncluded
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
          }`}
          onClick={onToggleBreakfastIncluded}
        >
          <span aria-hidden="true">☕</span>
          <span>Breakfast included</span>
        </button>
      )}
      {onToggleSelfCheckIn && (
        <button
          type="button"
          data-testid="marketplace-filter-self-checkin"
          aria-pressed={selfCheckIn}
          className={`min-h-[44px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border flex items-center gap-1.5 ${
            selfCheckIn
              ? 'bg-black text-white border-black'
              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
          }`}
          onClick={onToggleSelfCheckIn}
        >
          <span aria-hidden="true">🔑</span>
          <span>Self check-in</span>
        </button>
      )}
      {pills.map(({ label, icon }) => {
        const isSelected = selectedAmenity === label;
        return (
          <button
            key={label}
            type="button"
            data-testid={`marketplace-amenity-${label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`min-h-[38px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors border flex items-center gap-1.5 ${
              isSelected
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
            onClick={() => onSelectAmenity(selectedAmenity === label ? null : label)}
          >
            <span aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
      {selectedAmenity && (
        <button
          type="button"
          className="text-xs text-text-muted hover:text-black underline ml-1"
          onClick={() => onSelectAmenity(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}
