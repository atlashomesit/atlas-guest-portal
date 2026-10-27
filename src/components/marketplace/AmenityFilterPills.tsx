import { DEFAULT_MARKETPLACE_AMENITY_PILLS, type AmenityFilterPillItem } from '@/utils/amenityFilters';

export type AmenityFilterPillsProps = {
  selectedAmenity: string | null;
  onSelectAmenity: (amenity: string | null) => void;
  pills?: AmenityFilterPillItem[];
};

export default function AmenityFilterPills({
  selectedAmenity,
  onSelectAmenity,
  pills = DEFAULT_MARKETPLACE_AMENITY_PILLS,
}: AmenityFilterPillsProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="marketplace-amenities-pills">
      <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">Amenities:</span>
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
