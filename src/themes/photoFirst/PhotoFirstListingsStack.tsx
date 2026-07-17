/**
 * TASK-4925 / ADR-0081 D8 — "photoFirst" layout's full-bleed listings showcase.
 *
 * Founder-specified visual direction: "near-zero chrome ... huge full-bleed photography as the
 * primary content." This replaces `classic`'s uniform grid (`HomePage_Locations`) with a
 * vertical stack of edge-to-edge photo frames for this layout only — no card borders, no
 * shadows, no rounded corners; each listing IS one huge photograph with a minimal caption.
 *
 * Composes shared primitives ONLY — no forked booking/payment/listing-fetch logic
 * (AGENTS.md "Theme ≠ integration" HARD RULE), same precedent `coastal/ListingsGallery.tsx`
 * (TASK-4907) already established:
 *   - `useTenantListings()` — the same shared listing-data hook every other layout uses.
 *   - `calculateNightlyPrice`/`inferUnitType` — the same shared pricing utility functions.
 *   - `getPropertySlug`/`buildHomeUnitPath` — the same shared navigation utilities.
 *   - `getListingDisplayName` — the same shared SKU/floor-id display-name mapping.
 *   - `OptimizedImage` — the shared responsive-image component.
 * No new data-fetching path, no new pricing formula, no new booking/payment code.
 *
 * AA contrast note (epic §3.11/AC15, this task's stop-and-ask): caption text sits on a
 * deterministic bottom-scrim gradient (`photofirst-stack.css`), never directly on unpredictable
 * photo content — same scrim treatment as the hero (`Home.css`), verified against a worst-case
 * pure-white tenant photo in `defaultColorTokens.ts`'s header comment.
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

const PhotoFirstListingsStack = () => {
  const { properties } = useTenantListings();
  const { format: formatCurrency } = useCurrency();
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const unitNoun = getUnitNoun(overrides);

  if (!properties.length) return null;

  return (
    <section
      className="photofirst-stack"
      aria-labelledby="photofirst-listings-heading"
      data-testid="photofirst-listings-stack"
    >
      <h2 id="photofirst-listings-heading" className="sr-only">
        {`Our ${unitNoun.capitalPlural}, available to book`}
      </h2>
      <div role="list" aria-label={`${unitNoun.capitalPlural} available to book`}>
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
              className="photofirst-stack-frame"
              aria-label={`See ${title}`}
              data-testid="photofirst-stack-frame"
            >
              <OptimizedImage
                src={resolveCoverImage(property)}
                alt={title}
                className="photofirst-stack-photo"
                wrapperClassName="photofirst-stack-photo-inner"
                sizes="100vw"
                loading={index < 1 ? "eager" : undefined}
                showSkeleton={false}
              />
              <div className="photofirst-stack-scrim" aria-hidden="true" />
              <div className="photofirst-stack-caption">
                <span className="photofirst-stack-title">{title}</span>
                {property.property_location && (
                  <span className="photofirst-stack-location">{property.property_location}</span>
                )}
                {price != null && (
                  <span className="photofirst-stack-price">
                    {formatCurrency(price)} / night
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default PhotoFirstListingsStack;
