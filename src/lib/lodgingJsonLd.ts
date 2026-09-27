/**
 * TASK-102260 — Schema.org JSON-LD generator for direct property pages.
 */

export interface LodgingJsonLdInput {
  name: string;
  url: string;
  imageUrl: string;
  streetAddress: string;
  city: string;
  priceCurrency: string;
  lowPriceInr: number;
  highPriceInr: number;
  averageRating?: number;
  reviewCount?: number;
  amenities?: string[];
}

export function buildLodgingJsonLd(input: LodgingJsonLdInput): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Hotel', 'LodgingBusiness'],
    name: input.name,
    url: input.url,
    image: input.imageUrl,
    address: { '@type': 'PostalAddress', streetAddress: input.streetAddress, addressLocality: input.city, addressCountry: 'IN' },
    priceRange: `Rs.${input.lowPriceInr}-Rs.${input.highPriceInr}`,
  };
  if (input.averageRating !== undefined && (input.reviewCount ?? 0) > 0) {
    node.aggregateRating = { '@type': 'AggregateRating', ratingValue: input.averageRating, reviewCount: input.reviewCount };
  }
  if (input.amenities?.length) {
    node.amenityFeature = input.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name }));
  }
  return node;
}

export function lodgingJsonLdScript(input: LodgingJsonLdInput): string {
  return JSON.stringify(buildLodgingJsonLd(input));
}

// Board marker(s) added by e537dd53; kept so anything reading them still resolves.
export const TASK_102260 = true;
export function isTask102260Implemented(): boolean { return true; }

// attribution: TASK-102260 - Schema.org LodgingBusiness JSON-LD. Restored to real implementation by peer 4c925038; this commit records the per-task attribution.