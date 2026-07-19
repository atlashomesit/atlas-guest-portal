/**
 * TASK-4924 / ADR-0081 D8 — "editorial" layout's story-driven featured-stays section.
 *
 * Founder-specified visual direction (ATLAS-DEVELOPER-TASKS.md TASK-4924): "homepage/listing
 * pages read more like a magazine feature (long-form copy blocks, ... narrative section
 * ordering) than the card-grid composition of classic/heritage." This is the single largest
 * IA divergence in the layout (per the task's own framing, "the most structurally distinct
 * layout in the launch lineup") — it replaces `classic`'s uniform grid (`HomePage_Locations`)
 * and `coastal`'s horizontal scroll gallery with a vertical, alternating feature-spread flow:
 * one listing per "chapter", image and narrative copy trading sides down the page, each
 * captioned like a magazine feature rather than presented as an interchangeable grid card.
 *
 * Composes shared primitives ONLY — no forked booking/payment/listing-fetch logic
 * (AGENTS.md "Theme ≠ integration" HARD RULE), same reuse set `coastal/ListingsGallery.tsx`
 * (TASK-4907) already established:
 *   - `useTenantListings()` — the same shared listing-data hook every other layout uses.
 *   - `calculateNightlyPrice`/`inferUnitType` — the same shared pricing utility functions
 *     `HomePage_Locations` itself calls (not reimplemented).
 *   - `getPropertySlug`/`buildHomeUnitPath` — the same shared navigation utilities.
 *   - `OptimizedImage` — the shared responsive-image component.
 * No new data-fetching path, no new pricing formula, no new booking/payment code. The
 * booking/payment entry point itself lives in the hero (the real, shared
 * `SearchAvailabilityWidget`, see `Home.tsx`) — this section links each stay through to its
 * existing listing/booking detail page (`buildHomeUnitPath`), never re-implementing booking.
 *
 * WCAG AA binding discipline: all copy (heading, narrative body, price, location, and the
 * "Read the stay" link label) is bound to `--text-primary`/`--text-body` only (verified
 * >=4.5:1 across editorial's default palette and every curated color preset — see
 * `defaultColorTokens.ts`'s header comment). `--brand-primary`/`--cta-primary` are used only
 * as a decorative underline/rule (`Home.css`'s `.editorial-chapter-cta`), never as a solid
 * button fill with a fixed-color label — that combination is not guaranteed >=4.5:1 across
 * every declared preset (`Home.css`'s own comment has the full reasoning).
 */
import { Link } from "react-router-dom";
import { useTenantListings, type TenantPropertyRecord } from "../../hooks/useTenantListings";
import { calculateNightlyPrice, inferUnitType } from "../../utils/pricing";
import { getPropertySlug, buildHomeUnitPath } from "../../utils/navigation";
import { getListingDisplayName } from "../../lib/listingDisplayName";
import { getPropertyDesignImage } from "../../config/branding";
import { sanitizeGuestImageUrl, filterGuestImageUrls } from "../../utils/guestImageUrl";
import { getUnitNoun, getTenantOverrides } from "../../tenant/tenantOverrides";
import { getTenantContext } from "../../tenant/tenantContext";
import { useCurrency } from "../../contexts/CurrencyContext";
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

// Short, story-flavoured standing copy per feature "chapter" — content, not logic (same
// static-copy convention `classic`/`coastal`'s WHY_DIRECT_ITEMS already establish).
const CHAPTER_DEK =
  "A short read before you book: what the space feels like, who it suits, and what to expect on arrival.";

const EditorialFeaturedStays = () => {
  const { properties } = useTenantListings();
  const { format: formatCurrency } = useCurrency();
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  const unitNoun = getUnitNoun(overrides);

  if (!properties.length) return null;

  return (
    <section
      className="editorial-featured-stays"
      aria-labelledby="editorial-featured-stays-heading"
      data-testid="editorial-featured-stays"
    >
      <div className="editorial-section-inner">
        <div className="editorial-section-heading">
          <span className="editorial-eyebrow">Featured stays</span>
          <h2 id="editorial-featured-stays-heading" className="editorial-h2">
            {`A closer look at our ${unitNoun.plural}`}
          </h2>
          <p className="editorial-dek">{CHAPTER_DEK}</p>
        </div>

        <ol className="editorial-chapters" aria-label={`${unitNoun.capitalPlural} available to book`}>
          {properties.map((property, index) => {
            const listingId = property.listingId ?? Number(property.id);
            const slug = getPropertySlug({
              id: property.id,
              property_name: property.property_name,
            });
            const path = Number.isFinite(listingId) ? buildHomeUnitPath(slug, listingId) : "#";
            const title = getListingDisplayName(property.id, property.property_name);
            const price = resolvePrice(property);
            const isReversed = index % 2 === 1;

            return (
              <li
                key={`${property.id}-${index}`}
                className={`editorial-chapter${isReversed ? " editorial-chapter-reversed" : ""}`}
              >
                <div className="editorial-chapter-media">
                  <OptimizedImage
                    src={resolveCoverImage(property)}
                    alt={title}
                    className="editorial-chapter-photo"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    loading={index < 1 ? "eager" : undefined}
                    showSkeleton={false}
                  />
                </div>
                <div className="editorial-chapter-copy">
                  <span className="editorial-chapter-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="editorial-chapter-title">{title}</h3>
                  {property.property_location && (
                    <p className="editorial-chapter-location">{property.property_location}</p>
                  )}
                  {property.property_description && (
                    <p className="editorial-chapter-description">{property.property_description}</p>
                  )}
                  <div className="editorial-chapter-footer">
                    {price != null && (
                      <span className="editorial-chapter-price">{formatCurrency(price)} / night</span>
                    )}
                    <Link to={path} className="editorial-chapter-cta" aria-label={`Read the stay: ${title}`}>
                      Read the stay &rarr;
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default EditorialFeaturedStays;
