import React from "react";

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
  petFriendly,
  onClick,
}) => (
  <article
    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 md:hover:-translate-y-1 md:hover:shadow-xl"
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
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 shadow">
        {propertyType}
      </span>
    </div>

    <div className="flex flex-1 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-600">{location}</p>
        </div>
      <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
        <span aria-hidden>★</span>
        <span>{rating > 0 ? rating.toFixed(2) : "New"}</span>
        <span className="text-gray-500">({reviews.toLocaleString()})</span>
      </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>{guests} guests</span>
        <span aria-hidden>•</span>
        <span className="capitalize">{propertyType.toLowerCase()}</span>
        {petFriendly && (
          <>
            <span aria-hidden>•</span>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Pet-friendly</span>
          </>
        )}
      </div>

      <div className="mt-auto pt-2 text-sm text-gray-700">
        <div className="text-lg font-semibold text-gray-900">
          {formatCurrency(price)}/night
          <span className="ml-2 text-xs font-semibold text-gray-600">– all fees included</span>
        </div>
      </div>
    </div>
  </article>
);

export default ListingCard;
