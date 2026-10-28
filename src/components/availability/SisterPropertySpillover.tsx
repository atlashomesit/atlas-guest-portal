import { Link } from 'react-router-dom';
import { buildSisterListingHref } from '@/api/sisterAvailabilityClient';
import type { SisterListingOffer, SisterPropertyCard, SisterSpillover } from '@/api/sisterAvailabilityClient';

export interface SisterPropertySpilloverProps {
  /** The API answer; null (no answer / failed) renders nothing. */
  data: SisterSpillover | null;
  /** The stay the guest chose (yyyy-MM-dd) - carried to the sister listing in one tap. */
  checkIn?: string | null;
  checkOut?: string | null;
  guests: number;
  /** Marketplace only: the host tenant the current page is read under, kept on the link so the sister page resolves the same brand. */
  tenantSlug?: string | null;
  className?: string;
}

/** The API's amount exactly as returned: no rounding to whole rupees, no recomputation. */
function formatAmount(amount: number, currency: string): string {
  const text = amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${text}` : `${currency} ${text}`;
}

function placeLine(card: SisterPropertyCard): string {
  const place = [card.city, card.state].filter(Boolean).join(', ');
  const distance =
    card.distanceKm !== null
      ? `${card.distanceKm.toLocaleString('en-IN', { maximumFractionDigits: 1 })} km away`
      : '';
  return [place, distance].filter(Boolean).join(' · ');
}

/**
 * CHN-012 (guest half): "This property is full for your dates. Available at our sister property".
 * Read-only suggestion: it renders nothing unless the API says the viewed property is sold out AND returned at least one card.
 * All text is React text; each card is one real link.
 */
export default function SisterPropertySpillover({
  data,
  checkIn,
  checkOut,
  guests,
  tenantSlug,
  className = '',
}: SisterPropertySpilloverProps) {
  if (!data || !data.sourceSoldOut || data.properties.length === 0) return null;

  return (
    <section
      className={`rounded-xl border-2 border-teal-200 bg-teal-50/80 p-4 text-teal-950 shadow-sm space-y-3 ${className}`}
      data-testid="sister-property-spillover"
      aria-labelledby="sister-spillover-headline"
    >
      <h4 id="sister-spillover-headline" className="text-sm font-bold text-teal-900 leading-snug" data-testid="sister-spillover-headline">
        This property is full for your dates. Available at our sister property
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.properties.flatMap((property) =>
          property.listings.map((offer: SisterListingOffer) => (
            <div
              key={`${property.propertyId}-${offer.listingId}`}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-teal-200 bg-white/90 text-xs shadow-2xs"
              data-testid={`sister-offer-${offer.listingId}`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{offer.listingName}</p>
                <p className="text-slate-700 truncate">
                  {property.propertyName}
                  {placeLine(property) ? ` · ${placeLine(property)}` : ''}
                </p>
                <p className="text-teal-800 font-medium">
                  {formatAmount(offer.totalAmount, offer.currency)} total
                  {offer.averagePerNight > 0 ? ` · ${formatAmount(offer.averagePerNight, offer.currency)} / night` : ''}
                </p>
              </div>
              <Link
                to={buildSisterListingHref(property, offer.listingId, checkIn, checkOut, guests, tenantSlug)}
                data-testid={`sister-offer-link-${offer.listingId}`}
                aria-label={`View ${offer.listingName} at ${property.propertyName}`}
                className="flex-shrink-0 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 transition"
              >
                View
              </Link>
            </div>
          )),
        )}
      </div>
    </section>
  );
}
