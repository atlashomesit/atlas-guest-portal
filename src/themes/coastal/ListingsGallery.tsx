/**
 * TASK-4907 / ADR-0081 D8 — "coastal" layout's horizontal listings gallery.
 *
 * Founder-specified visual direction: "horizontal gallery layouts (as opposed to the
 * default's grid/card composition)" — this replaces `classic`'s uniform 3-col grid
 * (`HomePage_Locations`) with a horizontal, scroll-snap photo strip for this layout only.
 *
 * Composes shared primitives ONLY — no forked booking/payment/listing-fetch logic
 * (AGENTS.md "Theme ≠ integration" HARD RULE):
 *   - `useTenantListings()` — the same shared listing-data hook every other layout uses.
 *   - `calculateNightlyPrice`/`inferUnitType` — the same shared pricing utility functions
 *     `HomePage_Locations` itself calls (not reimplemented).
 *   - `getPropertySlug`/`buildHomeUnitPath` — the same shared navigation utilities.
 *   - `OptimizedImage` — the shared responsive-image component.
 * No new data-fetching path, no new pricing formula, no new booking/payment code.
 */
import { Link } from "react-router-dom";
import { useTenantListings, type TenantPropertyRecord } from "../../hooks/useTenantListings";
import { useCurrency } from "../../contexts/CurrencyContext";
import { calculateNightlyPrice, inferUnitType } from "../../utils/pricing";
import { getPropertySlug, buildHomeUnitPath } from "../../utils/navigation";
import { getListingDisplayName } from "../../lib/listingDisplayName";
import { getPropertyDesignImage } from "../../config/branding";
import { sanitizeGuestImageUrl, filterGuestImageUrls } from "../../utils/guestImageUrl";
import { getUnitNoun, getTenantOverrides } from "../../tenant/tenantOverrides";
import { getTenantContext } from "../../tenant/tenantContext";
import OptimizedImage from "../../components/ui/OptimizedImage";

const resolveCoverImage = (property: TenantPropertyRecord): string => {
  const filtered = filterGuestImageUrls(property.property_img ?? []);
  if (filtered.length > 0) return filtered[0];
  return sanitizeGuestImageUrl(getPropertyDesignImage(property.id)) ?? getPropertyDesignImage(property.id);
};

const resolvePrice = (property: TenantPropertyRecord): number | null => {
  try {
    const breakdown = calculateNightlyPrice({
      unitType: inferUnitType(property),
      checkInDate: new Date(),
    });
    return breakdown.finalNightlyPrice;
  } catch {
    return null;
  }
};

const CoastalListingsGallery = () => {
  const { properties } = useTenantListings();
  const { format: formatCurrency } = useCurrency();
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const unitNoun = getUnitNoun(overrides);

  if (!properties.length) return null;

  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 scroll-mt-28"
      style={{ background: "var(--bg-secondary, #e3f5fa)" }}
      id="our-homes"
      aria-labelledby="coastal-gallery-heading"
      data-testid="coastal-listings-gallery"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <h2
            id="coastal-gallery-heading"
            className="text-2xl md:text-3xl font-medium"
            style={{ color: "var(--text-primary, #082f3a)" }}
          >
            {`Our ${unitNoun.capitalPlural}, by the sea breeze`}
          </h2>
          <p className="text-sm max-w-xs sm:text-right leading-relaxed" style={{ color: "var(--text-primary, #082f3a)" }}>
            {properties.length} owner-run {properties.length === 1 ? unitNoun.singular : unitNoun.plural}. Scroll to browse.
          </p>
        </div>

        {/* Horizontal scroll-snap gallery — coastal's own composition, not a grid. */}
        <div
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-pl-4 -mx-4 px-4 pb-4 coastal-gallery-track"
          role="list"
          aria-label={`${unitNoun.capitalPlural} available to book`}
        >
          {properties.map((property, index) => {
            const listingId = property.listingId ?? Number(property.id);
            const slug = getPropertySlug({
              id: property.id,
              property_name: property.property_name,
            });
            const path = Number.isFinite(listingId) ? buildHomeUnitPath(slug, listingId) : "#";
            const title = getListingDisplayName(property.id, property.property_name);
            const price = resolvePrice(property);

            return (
              <Link
                key={`${property.id}-${index}`}
                to={path}
                role="listitem"
                className="coastal-gallery-card snap-start shrink-0"
                aria-label={`See ${title}`}
                style={{ background: "var(--bg-card, #ffffff)" }}
              >
                <OptimizedImage
                  src={resolveCoverImage(property)}
                  alt={title}
                  className="coastal-gallery-photo"
                  wrapperClassName="coastal-gallery-photo-inner"
                  sizes="(max-width: 640px) 80vw, 360px"
                  loading={index < 2 ? "eager" : undefined}
                  showSkeleton={false}
                />
                <div className="coastal-gallery-body">
                  <h3 className="text-lg font-medium" style={{ color: "var(--text-primary, #082f3a)" }}>
                    {title}
                  </h3>
                  {property.property_location && (
                    <p className="text-sm" style={{ color: "var(--text-primary, #082f3a)" }}>
                      {property.property_location}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {/* TASK-4908 gate fix: was bound to --cta-primary (a decorative/button
                        token, unaudited for text use) — confirmed failing AA (3.77-4.30:1)
                        against this card's white background. --cta-text is a small-TEXT-safe
                        variant (see base.css's token comment); --cta-primary itself, and every
                        button that uses it, is unchanged. */}
                    {price != null ? (
                      <span className="text-sm font-semibold" style={{ color: "var(--cta-text, #0b5a70)" }}>
                        {formatCurrency(price)} / night
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm font-medium underline" style={{ color: "var(--cta-text, #0b5a70)" }}>
                      View stay →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CoastalListingsGallery;
