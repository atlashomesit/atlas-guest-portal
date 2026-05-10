import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ListingCard from "@/components/apartments/ListingCard";
import SEO from "@/components/SEO";
import { fetchPublicListings, type PublicListing } from "@/api/listingClient";
import { filterGuestImageUrls, sanitizeGuestImageUrl } from "@/utils/guestImageUrl";
import { buildHomeUnitPath, getPropertySlug } from "@/utils/navigation";
import { listingMatchesCityKeywords } from "@/utils/cityListingFilter";
import { getEffectiveDiscountPercent } from "@/utils/pricing";
import { getTenantBrandName } from "@/tenant/displayBrand";
import { getTenantContext } from "@/tenant/tenantContext";
import { getTenantOverrides, getTenantPublicListingIdAllowlist } from "@/tenant/tenantOverrides";

import coorgContent from "@/content/cities/coorg.json";
import goaContent from "@/content/cities/goa.json";
import hyderabadContent from "@/content/cities/hyderabad.json";
import manaliContent from "@/content/cities/manali.json";
import { type CityLandingSlug } from "@/content/cities/cityLandingSlugs";

export type CityLandingPageProps = {
  citySlug: CityLandingSlug;
};

type CityFaqItem = { question: string; answer: string };

export type CityLandingJson = {
  slug: string;
  cityName: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  listingKeywords: string[];
  introParagraphs: string[];
  areasTitle: string;
  areas: { title: string; body: string }[];
  seasonTitle: string;
  seasonParagraphs: string[];
  faq: CityFaqItem[];
};

const CITY_CONTENT: Record<CityLandingSlug, CityLandingJson> = {
  goa: goaContent as CityLandingJson,
  coorg: coorgContent as CityLandingJson,
  hyderabad: hyderabadContent as CityLandingJson,
  manali: manaliContent as CityLandingJson,
};

function toListingCardModel(listing: PublicListing) {
  const propertySlug = getPropertySlug({ name: listing.propertyName || listing.name });
  const image =
    filterGuestImageUrls(listing.photoUrls ?? [])[0] ?? sanitizeGuestImageUrl(listing.coverPhotoUrl) ?? "";
  const rating = listing.propertyRating ?? 0;
  const reviews = listing.reviewCount ?? 0;
  const hasVerifiedReviews = reviews > 0 && rating > 0;
  return {
    propertySlug,
    listingId: listing.id,
    id: String(listing.id),
    name: listing.name || listing.propertyName || "Homestay",
    location: listing.propertyAddress || listing.propertyName || "",
    neighborhoods: [] as string[],
    image,
    price: listing.baseNightlyRate ?? 0,
    pricingBreakdown: null as null,
    rating: hasVerifiedReviews ? rating : 0,
    reviews: hasVerifiedReviews ? reviews : 0,
    propertyType: "Homestay",
    guests: listing.maxGuests > 0 ? listing.maxGuests : 2,
    bedrooms: null as number | null,
    hasWifi: (listing.wifiSpeedMbps ?? 0) > 0,
    hasParking: false,
    petFriendly: false,
    lastBookedAt: listing.lastBookedAt ?? undefined,
    losDiscountMinNights: listing.losDiscountMinNights ?? undefined,
    losDiscountPercent: listing.losDiscountPercent ?? undefined,
    losDiscount2MinNights: listing.losDiscount2MinNights ?? undefined,
    losDiscount2Percent: listing.losDiscount2Percent ?? undefined,
  };
}

const CityLandingPage = ({ citySlug }: CityLandingPageProps) => {
  const navigate = useNavigate();
  const brandName = getTenantBrandName();
  const content = CITY_CONTENT[citySlug];
  const [listings, setListings] = useState<PublicListing[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const directBookingDiscountPercent = useMemo(() => getEffectiveDiscountPercent(), []);

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    }),
    [content.faq],
  );

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchPublicListings(signal);
        const tenantOverrides = getTenantOverrides(getTenantContext()?.slug);
        const allow = getTenantPublicListingIdAllowlist(tenantOverrides);
        let rows = data.filter((row) => listingMatchesCityKeywords(row, content.listingKeywords));
        if (allow.size > 0) {
          rows = rows.filter((u) => allow.has(u.id));
        }
        setListings(rows);
      } catch (e) {
        setListings([]);
        setLoadError(e instanceof Error ? e.message : "Could not load listings.");
      } finally {
        setLoading(false);
      }
    },
    [content.listingKeywords],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const cards = useMemo(() => {
    if (!listings) return [];
    return listings.map(toListingCardModel);
  }, [listings]);

  const pagePath = `/homestays-in-${citySlug}`;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 text-text-primary">
      <SEO
        title={`${content.metaTitle} | ${brandName}`}
        description={content.metaDescription}
        url={pagePath}
        jsonLd={faqJsonLd}
      />

      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Destination guide</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-text-primary">{content.h1}</h1>
        <p className="mt-3 text-sm text-text-muted max-w-3xl">
          Live homestays below are drawn from our public catalogue and matched to {content.cityName} using address and
          title keywords. The API does not yet expose{" "}
          <code className="text-xs bg-bg-muted px-1 rounded">GET /listings/public?city=…</code>, so results may omit
          valid homes when addresses omit common locality spellings. A server-side city filter is planned as a
          follow-up for accuracy at scale.
        </p>
      </header>

      <article className="prose prose-neutral max-w-none dark:prose-invert">
        <div className="space-y-4 text-base leading-relaxed text-text-primary not-prose">
          {content.introParagraphs.map((p, i) => (
            <p key={`intro-${i}`}>{p}</p>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-text-primary mt-12 mb-4 not-prose">{content.areasTitle}</h2>
        <ul className="space-y-6 list-none p-0 m-0 not-prose">
          {content.areas.map((a) => (
            <li key={a.title} className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-text-primary">{a.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">{a.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="text-2xl font-bold text-text-primary mt-12 mb-4 not-prose">{content.seasonTitle}</h2>
        <div className="space-y-3 text-base leading-relaxed text-text-primary not-prose">
          {content.seasonParagraphs.map((p, i) => (
            <p key={`season-${i}`}>{p}</p>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-text-primary mt-12 mb-4 not-prose">Homestays in {content.cityName}</h2>
        {loading && (
          <p className="text-text-muted not-prose" role="status">
            Loading listings…
          </p>
        )}
        {loadError && (
          <p className="text-red-700 text-sm not-prose" role="alert">
            {loadError}
          </p>
        )}
        {!loading && !loadError && cards.length === 0 && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 not-prose">
            <p className="text-text-muted">
              No published listings matched our {content.cityName} keywords yet. Try the main search to browse all
              homes.
            </p>
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-cta-primary px-5 py-3 text-sm font-semibold text-[var(--text-contrast)] shadow hover:bg-cta-secondary"
            >
              Open search
            </button>
          </div>
        )}
        {!loading && cards.length > 0 && (
          <section
            className="grid grid-cols-1 gap-6 md:grid-cols-2 not-prose"
            aria-label={`Homestays in ${content.cityName}`}
            data-testid="city-landing-listings"
          >
            {cards.map((c) => (
              <ListingCard
                key={c.id}
                id={c.id}
                name={c.name}
                location={c.location}
                neighborhoods={c.neighborhoods}
                image={c.image}
                price={c.price}
                pricingBreakdown={c.pricingBreakdown}
                rating={c.rating}
                reviews={c.reviews}
                propertyType={c.propertyType}
                guests={c.guests}
                bedrooms={c.bedrooms}
                hasWifi={c.hasWifi}
                hasParking={c.hasParking}
                petFriendly={c.petFriendly}
                lastBookedAt={c.lastBookedAt}
                losDiscountMinNights={c.losDiscountMinNights ?? null}
                losDiscountPercent={c.losDiscountPercent ?? null}
                losDiscount2MinNights={c.losDiscount2MinNights ?? null}
                losDiscount2Percent={c.losDiscount2Percent ?? null}
                directBookingDiscountPercent={directBookingDiscountPercent}
                onClick={() => navigate(buildHomeUnitPath(c.propertySlug, c.listingId))}
              />
            ))}
          </section>
        )}

        <h2 className="text-2xl font-bold text-text-primary mt-14 mb-4 not-prose">Frequently asked questions</h2>
        <dl className="space-y-6 not-prose">
          {content.faq.map((item) => (
            <div key={item.question} className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
              <dt className="font-semibold text-text-primary">{item.question}</dt>
              <dd className="mt-2 text-sm text-text-muted leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
};

export default CityLandingPage;
