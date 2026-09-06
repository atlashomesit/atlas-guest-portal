import React, { useMemo, useState } from "react";
import { Bath, BedDouble, Car, PawPrint, Snowflake, Users, Wifi } from "lucide-react";
import { priceDisplayConfig } from "../../config/priceDisplay.config";
import { type NightlyPriceBreakdown } from "../../utils/pricing";
import OptimizedImage from "../ui/OptimizedImage";
import OwnerShareBadge from "../OwnerShareBadge"; // TASK-1705
import { useCurrency } from "../../contexts/CurrencyContext";
import { useBooking } from "../../contexts/BookingContext";
import { estTotalInclGst, estimateStayNights, formatEstTotalInclGst } from "../../utils/guestPriceEstimate";
import { getPropertyDesignImage } from "../../config/branding";
import { resolveAmenityLabel } from "../../utils/amenityCodes";
import {
  resolveListingCardCancellationChip,
  type CancellationTier,
} from "../../utils/cancellationPolicy";
import { hasOnlinePaymentRail } from "../../tenant/paymentRail";

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
  /** TASK-4012: review count for rating chip */
  reviewCount?: number | null;
  propertyType: string;
  guests: number;
  bedrooms?: number | null;
  hasWifi?: boolean;
  hasParking?: boolean;
  petFriendly: boolean;
  /** TASK-5198: real amenity codes from the listing payload (replaces hardcoded room map). */
  amenityCodes?: string[];
  /** TASK-1360: ISO date of most recent checkout within 30 days for social-proof badge. */
  lastBookedAt?: string | null;
  /** TASK-1695: LOS auto-discount tier 1 — minimum nights required. */
  losDiscountMinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 1 — discount percentage (0-100). */
  losDiscountPercent?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 — minimum nights required. */
  losDiscount2MinNights?: number | null;
  /** TASK-1695: LOS auto-discount tier 2 — discount percentage (0-100). */
  losDiscount2Percent?: number | null;
  /** TASK-2903: nights for est-total line (default 1 when dates unknown). */
  estimateNights?: number;
  /** TASK-4011: last-minute discount percentage (0-100) when available. */
  lastMinuteDiscountPercent?: number | null;
  /** TASK-4312: whether the listing owner is GST-registered. */
  isGstRegistered?: boolean;
  /** DESIGN-028: listing-scoped cancellation tier for the card trust chip. */
  cancellationTier?: CancellationTier | string | null;
  onClick?: () => void;
};

// TASK-1687: replaced module-level INR-only formatter with the
// CurrencyContext-aware one (see useCurrency() in the component body).

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
  reviewCount,
  propertyType,
  guests,
  bedrooms,
  hasWifi,
  hasParking,
  petFriendly,
  amenityCodes,
  lastBookedAt,
  losDiscountMinNights,
  losDiscountPercent,
  losDiscount2MinNights,
  losDiscount2Percent,
  estimateNights: estimateNightsProp,
  lastMinuteDiscountPercent,
  isGstRegistered = true, // TASK-4312: default to true for backward compat
  cancellationTier = null,
  onClick,
}) => {
  const cancellationChip = resolveListingCardCancellationChip(cancellationTier);
  // TASK-101158: never claim "Secure Razorpay payments" on a tenant with no online rail
  // (bookingMode WHATSAPP/MANUAL or paymentProvider null) — omit the chip, don't reword it.
  const showRazorpayChip = hasOnlinePaymentRail();
  const { format: formatCurrency } = useCurrency();
  const { booking } = useBooking();
  const estimateNights = useMemo(() => {
    if (estimateNightsProp != null) return estimateNightsProp;
    const ci = booking.checkIn ? new Date(booking.checkIn) : null;
    const co = booking.checkOut ? new Date(booking.checkOut) : null;
    return estimateStayNights(ci, co);
  }, [estimateNightsProp, booking.checkIn, booking.checkOut]);
  /** TASK-4013: Toggle between per-night and total price display */
  const [showTotal, setShowTotal] = useState(false);
  // TASK-1360: Compute "Last booked X days ago" label
  const lastBookedLabel = useMemo(() => {
    if (!lastBookedAt) return null;
    const days = Math.round((Date.now() - new Date(lastBookedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Booked today";
    if (days === 1) return "Booked yesterday";
    if (days <= 30) return `Last booked ${days} days ago`;
    return null;
  }, [lastBookedAt]);
  const finalPrice = pricingBreakdown?.finalNightlyPrice ?? price;
  // Published/sticker rate, used only for the "was ₹X" strikethrough display below (and the
  // savings badge) when a discount applies. TASK-7543: this must NOT be passed to
  // `estTotalInclGst`/`formatEstTotalInclGst` as their banding-basis override anymore — the server
  // now selects the GST band off the CHARGED rate (`finalPrice`), not this published rate; see
  // accommodationGstSlabPercentForChargedRate's doc comment in guestPriceEstimate.ts.
  const originalPrice = pricingBreakdown?.baseNightlyPrice ?? price;
  /** TASK-1660: only treat star average as verified when at least one guest review exists. */
  const hasVerifiedReviews = reviews > 0 && rating > 0;
  const ratingSnippet = hasVerifiedReviews ? `${rating.toFixed(2)} / 5` : "Reviews after first stay";
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

  const amenities = useMemo(() => {
    if (!amenityCodes?.length) return [] as string[];
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const code of amenityCodes) {
      const label = resolveAmenityLabel(code);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
    }
    return labels;
  }, [amenityCodes]);

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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface transition duration-200 md:hover:-translate-y-1 md:"
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
          src={image?.trim() ? image : getPropertyDesignImage(id)}
          alt={name}
          className="h-full w-full object-cover transition duration-200 md:group-hover:scale-105"
          wrapperClassName="h-full"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)] px-3 py-1 text-xs font-semibold text-text-primary">
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
                    className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,var(--bg-muted)_40%,var(--bg-surface))] px-2 py-1 text-xs font-semibold text-text-primary"
                  >
                    <span aria-hidden>📍</span>
                    <span>{neighborhood}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* TASK-4012: Rating chip on listing cards */}
          <div className="flex flex-shrink-0 items-center">
            {hasVerifiedReviews && (reviewCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-sm font-semibold text-yellow-800">
                <span aria-hidden>★</span>
                <span>{rating.toFixed(1)}</span>
                <span className="text-xs font-normal">({(reviewCount ?? 0).toLocaleString()})</span>
              </span>
            ) : hasVerifiedReviews ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-text-primary">
                <span aria-hidden>★</span>
                <span>{rating.toFixed(2)}</span>
                <span className="text-text-muted">({reviews.toLocaleString()})</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-text-muted">New listing</span>
            )}
          </div>
        </div>

        {/* TASK-1360: Last-booked social-proof badge */}
        {lastBookedLabel && (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
            🔥 {lastBookedLabel}
          </span>
        )}

        {/* TASK-4011: Last-minute discount badge */}
        {(lastMinuteDiscountPercent ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-700">
            ⚡ Last-minute — save {Math.round(lastMinuteDiscountPercent!)}%
          </span>
        )}

        {/* TASK-1695: LOS discount badges */}
        {((losDiscountMinNights ?? 0) > 0 && (losDiscountPercent ?? 0) > 0) && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              🏷 Stay {losDiscountMinNights}+ nights → save {Math.round(losDiscountPercent!)}%
            </span>
            {(losDiscount2MinNights ?? 0) > 0 && (losDiscount2Percent ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                🏷 Stay {losDiscount2MinNights}+ nights → save {Math.round(losDiscount2Percent!)}%
              </span>
            )}
          </div>
        )}

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
                    {showTotal ? (
                      <>
                        {/* TASK-4832: use the same est-total helper/inputs as the collapsed
                            estimate so the toggle never shows two different money totals
                            (previously omitted the 3% fee and the GST-registration flag). */}
                        {formatCurrency(estTotalInclGst(finalPrice, estimateNights, 3, isGstRegistered))}
                        <span className="ml-1 text-sm font-semibold text-text-muted">total</span>
                      </>
                    ) : (
                      <>
                        {formatCurrency(finalPrice)}
                        <span className="ml-1 text-sm font-semibold text-text-muted">/ night</span>
                      </>
                    )}
                  </div>
                </div>
                {/* TASK-4013: Toggle link for total with taxes; TASK-1645 / TASK-2871: Indian accommodation GST — 5% for ≤₹7,500/night, 18% above (eff. 22 Sep 2025) */}
                {showTotal ? (
                  <button
                    type="button"
                    onClick={() => setShowTotal(false)}
                    className="text-xs text-cta-primary hover:underline font-semibold self-start"
                  >
                    Hide total
                  </button>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      {formatEstTotalInclGst(finalPrice, estimateNights, formatCurrency, 3, isGstRegistered)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTotal(true)}
                      className="text-xs text-cta-primary hover:underline font-semibold self-start"
                    >
                      See total with taxes ↓
                    </button>
                  </div>
                )}
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
                  {amenities.slice(0, 3).map((amenity: string) => {
                    const lower = amenity.toLowerCase();
                    const Icon =
                      lower.includes("wi-fi") || lower.includes("wifi")
                        ? Wifi
                        : lower.includes("air") || lower.includes("ac")
                          ? Snowflake
                          : lower.includes("park")
                            ? Car
                            : lower.includes("pet")
                              ? PawPrint
                              : Bath;
                    return (
                      <span key={amenity} className="inline-flex items-center gap-1">
                        <Icon className="h-4 w-4" aria-hidden />
                        <span className="truncate max-w-[140px]">{amenity}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="w-full rounded-xl bg-[color:color-mix(in_srgb,var(--bg-muted)_55%,var(--bg-surface))] px-3 py-2 text-xs font-semibold text-text-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">No hidden fees</span>
                  {showRazorpayChip && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">Secure Razorpay payments</span>
                  )}
                  {/* DESIGN-028: listing-scoped free-cancel promise (tier known here). */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1"
                    data-testid="listing-card-cancellation-chip"
                  >
                    {cancellationChip}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-2 py-1">
                    {hasVerifiedReviews ? `Avg. rating ${ratingSnippet}` : ratingSnippet}
                  </span>
                  {/* TASK-1705: Owner-share trust badge */}
                  <OwnerShareBadge nightlyPrice={finalPrice} />
                </div>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-[color:var(--text-on-cta)] transition duration-150 hover:-translate-y-0.5  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
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
