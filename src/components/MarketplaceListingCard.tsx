import React from 'react';
import { resolveMarketplaceListingDisplayName } from '../pages/MarketplaceHomepage';

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
        {city && (
          <span className="w-fit rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {city}
          </span>
        )}
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
          <p className="text-sm font-bold text-text-primary">
            ₹{pricePerNight.toLocaleString('en-IN')}/night
          </p>
        )}
      </div>
    </article>
  );
};

export default MarketplaceListingCard;
