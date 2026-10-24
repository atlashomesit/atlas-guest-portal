import React from 'react';
import {
  resolveMarketplaceListingDisplayName,
  resolvePropertyTypeBadge,
} from '../pages/MarketplaceHomepage';
import { resolveAmenityLabel } from '@/utils/amenityCodes';
import { isHostelDormType } from '@/utils/dormListing';

export interface MarketplaceListingCardProps {
  id?: number | string | null;
  name?: string | null;
  title?: string | null;
  displayName?: string | null;
  publicTitle?: string | null;
  nameFormatted?: string | null;
  slug?: string | null;
  pricePerNight?: number;
  city?: string | null;
  coverImageUrl?: string | null;
  maxGuests?: number;
  rating?: number | null;
  reviewCount?: number | null;
  propertyType?: string | null;
  accommodationType?: string | null;
  category?: string | null;
  amenities?: (string | { code?: string; name?: string; title?: string })[];
  amenityCodes?: string[];
  onClick?: () => void;
  className?: string;
}

export const MarketplaceListingCard: React.FC<MarketplaceListingCardProps> = ({
  id,
  name,
  title,
  displayName,
  publicTitle,
  nameFormatted,
  slug,
  pricePerNight,
  city,
  coverImageUrl,
  maxGuests,
  rating,
  reviewCount,
  propertyType,
  accommodationType,
  category,
  amenities,
  amenityCodes,
  onClick,
  className,
}) => {
  const displayTitle = resolveMarketplaceListingDisplayName({
    id,
    name,
    title,
    displayName,
    publicTitle,
    nameFormatted,
    slug,
  });

  const propertyTypeBadge = resolvePropertyTypeBadge({
    propertyType,
    accommodationType,
    category,
    title,
    name,
  });

  const isHostel = propertyTypeBadge === 'Hostel' || isHostelDormType(accommodationType);

  const rawAmenities: string[] = [
    ...(Array.isArray(amenityCodes) ? amenityCodes : []),
    ...(Array.isArray(amenities)
      ? amenities.map((a) => (typeof a === 'string' ? a : a.title || a.name || a.code || ''))
      : []),
  ].filter(Boolean);

  const amenityChips = Array.from(
    new Set(
      rawAmenities
        .map((c) => resolveAmenityLabel(c))
        .filter((l): l is string => Boolean(l)),
    ),
  ).slice(0, 3);

  return (
    <article
      data-testid="marketplace-card"
      onClick={onClick}
      className={className || "relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-sm transition-all hover:border-border-subtle hover:shadow-md cursor-pointer"}
    >
      {coverImageUrl && (
        <div className="h-40 w-full bg-bg-muted">
          <img
            src={coverImageUrl}
            alt={displayTitle}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-base font-semibold text-text-primary leading-snug">
          {displayTitle}
        </h2>

        {/* TASK-1039954: Aligned property type badge and amenity chips */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5" data-testid="marketplace-card-tags">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200"
              data-testid="property-type-badge"
            >
              {propertyTypeBadge}
            </span>
            {city && (
              <span className="w-fit rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary" data-testid="marketplace-city-badge">
                {city}
              </span>
            )}
            {amenityChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1 rounded-md bg-neutral-50 border border-neutral-200/80 px-2 py-0.5 text-xs text-neutral-600"
                data-testid="marketplace-amenity-chip"
              >
                {chip}
              </span>
            ))}
          </div>
          {isHostel && (
            <span
              className="inline-flex items-center self-start rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700"
              data-testid="hostel-per-bed-indicator"
            >
              Starting from per bed
            </span>
          )}
        </div>

        {maxGuests != null && (
          <p className="text-sm text-text-body">
            Sleeps up to {maxGuests} guest{maxGuests === 1 ? '' : 's'}
          </p>
        )}
        {rating != null && rating >= 4 && (
          <p className="text-sm font-medium text-[var(--accent-text)]">
            ★ {rating.toFixed(1)} {reviewCount ? `(${reviewCount})` : ''}
          </p>
        )}
        {pricePerNight != null && pricePerNight > 0 && (
          <p className="text-sm font-bold text-text-primary" data-testid="marketplace-card-price">
            ₹{pricePerNight.toLocaleString('en-IN')}{isHostel ? ' / bed / night' : '/night'}
          </p>
        )}
      </div>
    </article>
  );
};

export default MarketplaceListingCard;
