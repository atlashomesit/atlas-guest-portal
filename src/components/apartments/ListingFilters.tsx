import React from "react";

type ListingFiltersProps = {
  priceMin: number;
  priceMax: number;
  selectedMinPrice: number;
  selectedMaxPrice: number;
  guests: number;
  propertyType: string;
  petFriendlyOnly: boolean;
  sortBy: string;
  onPriceChange: (field: "min" | "max", value: number) => void;
  onGuestsChange: (value: number) => void;
  onPropertyTypeChange: (value: string) => void;
  onPetFriendlyChange: (value: boolean) => void;
  onSortChange: (value: string) => void;
};

const ListingFilters: React.FC<ListingFiltersProps> = ({
  priceMin,
  priceMax,
  selectedMinPrice,
  selectedMaxPrice,
  guests,
  propertyType,
  petFriendlyOnly,
  sortBy,
  onPriceChange,
  onGuestsChange,
  onPropertyTypeChange,
  onPetFriendlyChange,
  onSortChange,
}) => (
  <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
    <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        Min price (₹)
        <input
          type="number"
          min={priceMin}
          max={selectedMaxPrice}
          value={selectedMinPrice}
          onChange={(event) => onPriceChange("min", Number(event.target.value) || priceMin)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        Max price (₹)
        <input
          type="number"
          min={selectedMinPrice}
          max={priceMax}
          value={selectedMaxPrice}
          onChange={(event) => onPriceChange("max", Number(event.target.value) || priceMax)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        Guests
        <input
          type="number"
          min={1}
          max={8}
          value={guests}
          onChange={(event) => onGuestsChange(Number(event.target.value) || 1)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        Property type
        <select
          value={propertyType}
          onChange={(event) => onPropertyTypeChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All</option>
          <option value="Penthouse">Penthouse</option>
          <option value="Apartment">Apartment</option>
        </select>
      </label>
    </div>

    <div className="flex flex-col gap-3 sm:w-64">
      <label className="flex items-center justify-between text-sm font-semibold text-gray-700">
        <span>Pet friendly</span>
        <input
          type="checkbox"
          checked={petFriendlyOnly}
          onChange={(event) => onPetFriendlyChange(event.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
        Sort by
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="featured">Featured</option>
          <option value="price">Price</option>
          <option value="rating">Rating</option>
        </select>
      </label>
    </div>
  </div>
);

export default ListingFilters;
