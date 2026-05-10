/**
 * TASK-1477: Pure builder for LodgingBusiness JSON-LD (unit tests + HomeDetails).
 */
import { getPublicSiteOrigin } from "@/config/siteOrigin";

export type HomeDetailsJsonLdListing = {
  propertyAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  baseNightlyRate?: number | null;
  photoUrls?: string[] | null;
};

export type HomeDetailsJsonLdReviews = {
  totalCount: number;
  averageRating: number;
} | null;

export function buildHomeDetailsLodgingJsonLd(input: {
  roomTitle: string;
  roomHref: string;
  tagline?: string | null;
  highlights: string[];
  imageUrls: string[];
  apiListing?: HomeDetailsJsonLdListing | null;
  tenantBrandName: string;
  hideAtlasBranding: boolean;
  reviews: HomeDetailsJsonLdReviews;
}): Record<string, unknown> {
  const origin = getPublicSiteOrigin();
  const path = input.roomHref.startsWith("http") ? input.roomHref : `${origin}${input.roomHref.startsWith("/") ? "" : "/"}${input.roomHref}`;

  const amenities = (input.highlights ?? []).slice(0, 20);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: input.roomTitle,
    url: path,
    ...(input.tagline?.trim() ? { description: input.tagline.trim() } : {}),
    ...(input.imageUrls.length ? { image: input.imageUrls } : {}),
    ...(input.apiListing?.propertyAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: input.apiListing.propertyAddress,
            addressCountry: "IN",
          },
        }
      : {}),
    ...(input.apiListing?.latitude != null && input.apiListing?.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: input.apiListing.latitude,
            longitude: input.apiListing.longitude,
          },
        }
      : {}),
    ...(input.apiListing?.baseNightlyRate != null
      ? {
          priceRange: `₹${Math.round(Number(input.apiListing.baseNightlyRate))}+`,
        }
      : {}),
    amenityFeature: amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
    })),
  };

  if (input.reviews && input.reviews.totalCount > 0 && input.reviews.averageRating > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.min(5, Math.max(1, input.reviews.averageRating)),
      reviewCount: input.reviews.totalCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (input.hideAtlasBranding && input.tenantBrandName?.trim()) {
    schema.provider = {
      "@type": "Organization",
      name: input.tenantBrandName.trim(),
    };
  }

  return schema;
}
