import React, { useMemo } from "react";
import { Bath, BedDouble, Car, PawPrint, Snowflake, Users, Wifi } from "lucide-react";
import { priceDisplayConfig } from "../../config/priceDisplay.config";
import { type NightlyPriceBreakdown } from "../../utils/pricing";
import OptimizedImage from "../ui/OptimizedImage";
import OwnerShareBadge from "../OwnerShareBadge"; // TASK-1705

type ListingCardProps = {
  id: string;
  name: string;
  location: string;
  neighborhoods?: string[];
  image: string;
  price: number;
  pricingBreakdown?: NightlyPriceBreakdown | null;
  rating: number;
  reviews: number;
  propertyType: string;
  guests: number;
  bedrooms?: number | null;
  hasWifi?: boolean;
  hasParking?: boolean;
  petFriendly: boolean;
  onClick?: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const ListingCard: React.FC<ListingCardProps> = ({
  id,
  name,
  location,
  neighborhoods = [],
  image,
  price,
  pricingBreakdown,
  rating,
  reviews,
  propertyType,
  guests,
  bedrooms,
  hasWifi,
  hasParking,
  petFriendly,
  onClick,
}) => {
  const finalPrice = pricingBreakdown?.finalNightlyPrice ?? price;
  const originalPrice = pricingBreakdown?.baseNightlyPrice ?? price;
  const ratingSnippet = rating > 0 ? `${rating.toFixed(2)} / 5` : "Rating updates soon";
  const hasSpecialPricing = Boolean(pricingBreakdown?.hasSpecialDateMultiplier);
  const specialPricingLabel =
    hasSpecialPricing && pricingBreakdown?.dateKey
      ? priceDisplayConfig.specialPricingLabels[pricingBreakdown.dateKey] ??
        priceDisplayConfig.defaultSpecialLabel
      : hasSpecialPricing
        ? priceDisplayConfig.defaultSpecialLabel
        : null;
  const showDiscount = Boolean(
    pricingBreakdown &&
      pricingBreakdown.discountAmount > 0 &&
      !pricingBreakdown.hasSpecialDateMultiplier,
  );
  const savingsAmount = showDiscount ? pricingBreakdown?.discountAmount ?? 0 : 0;
  const badgeLabel =
    showDiscount && originalPrice > finalPrice
      ? priceDisplayConfig.discount.primaryBadgeLabel
      : specialPricingLabel;

  const AMENITY_MAP = useMemo(
    () => ({
      "501": ["Wi-Fi", "Air conditioning", "Private bath"],
      "201": ["Wi-Fi", "Air conditioning"],
      "202": ["Wi-Fi", "Air conditioning"],
      "301": ["Wi-Fi", "Air conditioning"],
      "101": ["Wi-Fi", "Air conditioning"],
      "102": ["Wi-Fi", "Air conditioning"],
      "302": ["Wi-Fi", "Air conditioning"],
    }),
    [],
  );

  const amenities = AMENITY_MAP[id] ?? [];

  const quickFacts = [
    {
      label: `${guests} guest${guests === 1 ? "" : "s"}`,
      icon: <Users className="h-4 w-4" aria-hidden />,
      visible: guests > 0,
    },
    {
      label: bedrooms ? `${bedrooms} BR` : "",
      icon: <BedDouble className="h-4 w-4" aria-hidden />,
      visible: Boolean(bedrooms),
    },
    {
      label: "Wi-Fi",
      icon: <Wifi className="h-4 w-4" aria-hidden />,
      visible: hasWifi,
    },
    {
      label: "Parking",
      icon: <Car className="h-4 w-4" aria-hidden />,
      visible: hasParking,
    },
    {
      label: "Pet friendly",
      icon: <PawPrint className="h-4 w-4" aria-hidden />,
      visible: petFriendly,
    },
  ].filter((item) => item.visible);

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 transition duration-200 md:hover:-translate-y-1 md:hover:shadow-level2"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="relative h-56 w-full overflow-hidden">
        <OptimizedImage
          src={image}
          alt={name}
          className="h-full w-full object-cover transition duration-200 md:group-hover:scale-105"
          wrapperClassName="h-full"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)] px-3 py-1 text-xs font-semibold text-text-primary shadow-level1">
          {propertyType}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-text-primary">{name}</h3>
            <p className="text-sm text-text-muted">{location}</p>
            {neighborhoods.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {neighborhoods.map((neighborhood) => (
                  <span
                    key={neighborhood}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--bg-muted)_40%,var(--bg-surface))] px-2 py-1 text-[11px] font-semibold text-text-primary"
                  >
                    <span aria-hidden>📍</span>
                    <span>{neighborhood}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-text-primary">
            <span aria-hidden>★</span>
            <span>{rating > 0 ? rating.toFixed(2) : "New"}</span>
            <span className="text-text-muted">({reviews.toLocaleString()})</span>
          </div>
        </div>

        {quickFacts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-primary sm:text-sm">
            {quickFacts.map((fact, index) => (
              <span
                key={`${fact.label}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--bg-muted)_40%,var(--bg-surface))] px-3 py-1 font-semibold"
              >
                <span aria-hidden>{fact.icon}</span>
                <span>{fact.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-2 text-sm text-text-muted">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-1 text-sm text-text-muted">
                <div className="flex flex-wrap items-baseline gap-2">
                  {showDiscount && originalPrice > finalPrice && (
                    <span className="text-xs font-semibold text-text-muted line-through">
                      {formatCurrency(originalPrice)}
                    </span>
                  )}
                  <div className="text-2xl font-bold leading-tight text-cta-primary">
                    {formatCurrency(finalPrice)}
                    <span className="ml-1 text-sm font-semibold text-text-muted">/ night</span>
                  </div>
                </div>
                {/* TASK-1870: Sept 2025 GST — 5% for ≤₹7,500/night, 18% above */}
                <span className="text-xs text-text-muted">
                  {(() => { const gstMult = finalPrice > 7500 ? 1.18 : 1.05; const pct = finalPrice > 7500 ? 18 : 5; return `${formatCurrency(Math.round(finalPrice * 2 * gstMult))} est. total incl. ${pct}% GST (2 nights)`; })()}
                </span>
                {showDiscount && savingsAmount > 0 && (
                  <span className="text-xs font-semibold text-cta-primary">
                    {priceDisplayConfig.discount.savingsPrefix} {formatCurrency(savingsAmount)}
                  </span>
                )}
                {badgeLabel && (
                  <span className="inline-flex w-fit items-center rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-cta-primary">
                    {badgeLabel}
                  </span>
                )}
              </div>

              {amenities.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-text-primary">
                  {amenities.slice(0, 3).map((amenity) => (
                    <span key={amenity} className="inline-flex items-center gap-1">
                      {amenity.toLowerCase().includes("wi-fi") ? (
                        <Wifi className="h-4 w-4" aria-hidden />
                      ) : amenity.toLowerCase().includes("air") ? (
                        <Snowflake className="h-4 w-4" aria-hidden />
                      ) : (
                        <Bath className="h-4 w-4" aria-hidden />
                      )}
                      <span className="truncate max-w-[140px]">{amenity}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="w-full rounded-xl bg-[color:color-mix(in_srgb,var(--bg-muted)_55%,var(--bg-surface))] px-3 py-2 text-xs font-semibold text-text-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">No hidden fees</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">Secure Razorpay payments</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">Avg. rating {ratingSnippet}</span>
                  {/* TASK-1705: Owner-share trust badge */}
                  <OwnerShareBadge nightlyPrice={finalPrice} />
                </div>
                {rating <= 0 && (
                  <p className="mt-1 text-[11px] font-normal text-text-muted">Avg. rating placeholder until live reviews sync.</p>
                )}
              </div>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--brand)] px-4 py-4 text-sm font-semibold text-[color:var(--text-contrast)] shadow-level1 transition duration-150 hover:-translate-y-0.5 hover:shadow-level2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onClick?.();
                }}
                aria-label={`View room ${name}`}
              >
                View room
              </button>
              <p className="w-full text-xs font-semibold text-text-muted">Total shown before payment; no hidden charges.</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ListingCard;
