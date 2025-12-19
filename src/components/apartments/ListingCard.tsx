import React from "react";
import { BedDouble, Car, PawPrint, Users, Wifi } from "lucide-react";

type ListingCardProps = {
  id: string;
  name: string;
  location: string;
  image: string;
  price: number;
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
  name,
  location,
  image,
  price,
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
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover transition duration-200 md:group-hover:scale-105"
          loading="lazy"
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
            <div>
              <div className="text-xl font-semibold text-text-primary leading-tight">
                {formatCurrency(price)}
                <span className="ml-1 text-base font-medium text-text-muted">/night</span>
              </div>
              <span className="text-xs font-semibold text-text-muted">All fees included</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-[color:var(--text-contrast)] shadow-level1 transition duration-150 hover:-translate-y-0.5 hover:shadow-level2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onClick?.();
                }}
              >
                View details
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ListingCard;
