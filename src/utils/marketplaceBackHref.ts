/**
 * TASK-1040085 & GUEST-051: Shared helpers for Property Details navigation and Similar Stays cards
 * across default (`Homepage_PropertyDetails.tsx`) and heritage (`themes/heritage/PropertyDetails.tsx`) surfaces.
 */

const SEARCH_FILTER_KEYS = [
  'city',
  'destination',
  'checkIn',
  'checkOut',
  'guests',
  'adults',
  'children',
  'minPrice',
  'maxPrice',
  'category',
  'amenity',
  'amenities',
  'sort',
  'sortBy',
] as const;

export function hasPropertyDetailSearchFilters(searchParams: URLSearchParams): boolean {
  return SEARCH_FILTER_KEYS.some((k) => searchParams.has(k));
}

/**
 * TASK-1040085: Preserves `?brand=atlastays` and `utm_*` attribution query parameters
 * when navigating back to marketplace home (`/`) or `/search`, even when the guest
 * arrived directly on a property detail page without search filter parameters.
 */
export function buildPropertyDetailBackHref(
  searchParams: URLSearchParams,
  isMarketplace: boolean,
): string {
  const hasFilters = hasPropertyDetailSearchFilters(searchParams);

  if (isMarketplace) {
    if (hasFilters) {
      const cleanParams = new URLSearchParams(searchParams);
      cleanParams.delete('tenant');
      const qs = cleanParams.toString();
      return qs ? `/?${qs}` : '/';
    }

    const preserved = new URLSearchParams();
    const brand = searchParams.get('brand');
    if (brand && brand.trim() !== '') {
      preserved.set('brand', brand.trim());
    }
    searchParams.forEach((value, key) => {
      if (key.toLowerCase().startsWith('utm_') && value.trim() !== '') {
        preserved.append(key, value);
      }
    });
    const qs = preserved.toString();
    return qs ? `/?${qs}` : '/';
  }

  if (hasFilters) {
    return `/search?${searchParams.toString()}`;
  }

  const preservedUtm = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key.toLowerCase().startsWith('utm_') && value.trim() !== '') {
      preservedUtm.append(key, value);
    }
  });
  const utmQs = preservedUtm.toString();
  return utmQs ? `/search?${utmQs}` : '/search';
}

/**
 * TASK-1040085 / GUEST-051: Builds query string for similar-stay links preserving
 * `tenant`, `brand`, and `utm_*` context.
 */
export function buildSimilarStayHref(
  basePath: string,
  tenantSlugFromUrl: string | null | undefined,
  searchParams: URLSearchParams,
): string {
  const qp = new URLSearchParams();
  if (tenantSlugFromUrl && tenantSlugFromUrl.trim() !== '') {
    qp.set('tenant', tenantSlugFromUrl.trim());
  }
  const brand = searchParams.get('brand');
  if (brand && brand.trim() !== '') {
    qp.set('brand', brand.trim());
  }
  searchParams.forEach((value, key) => {
    if (key.toLowerCase().startsWith('utm_') && value.trim() !== '') {
      qp.append(key, value);
    }
  });
  const qs = qp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export interface SimilarStayMeta {
  nightlyRate: number | null;
  currency: string;
  maxGuests: number | null;
  rating: number | null;
  reviewCount: number | null;
}

/**
 * GUEST-051: Extracts nightly rate, maxGuests, and verified (>= 4.0) rating/review metadata
 * from a `/listings/{id}/similar` item.
 */
export function extractSimilarStayMeta(it: Record<string, unknown>): SimilarStayMeta {
  const rawRate =
    it.baseNightlyRate ??
    it.BaseNightlyRate ??
    it.pricePerNight ??
    it.property_price ??
    it.nightlyRate;
  const parsedRate = Number(rawRate);
  const nightlyRate = Number.isFinite(parsedRate) && parsedRate > 0 ? Math.round(parsedRate) : null;

  const currency =
    typeof it.currency === 'string' && it.currency.trim() !== ''
      ? it.currency.trim().toUpperCase()
      : 'INR';

  const rawGuests = it.maxGuests ?? it.MaxGuests ?? it.guests;
  const parsedGuests = Number(rawGuests);
  const maxGuests = Number.isFinite(parsedGuests) && parsedGuests > 0 ? Math.floor(parsedGuests) : null;

  const rawRating = it.propertyRating ?? it.rating ?? it.averageRating ?? it.property_rating;
  const parsedRating = Number(rawRating);
  const rawReviews = it.reviewCount ?? it.property_reviews ?? it.reviews;
  const parsedReviews = Number(rawReviews);
  const reviewCount = Number.isFinite(parsedReviews) && parsedReviews > 0 ? Math.floor(parsedReviews) : null;
  // Enforce founder rule: sub-4-star ratings are never surfaced on guest cards
  const rating =
    Number.isFinite(parsedRating) && parsedRating >= 4
      ? parsedRating
      : null;

  return { nightlyRate, currency, maxGuests, rating, reviewCount };
}

/**
 * GUEST-051: Sorts similar stays so listings accommodating `targetGuests` appear first,
 * preserving server relative order within each bucket.
 */
export function selectSimilarStaysForParty<T extends Record<string, unknown>>(
  items: T[],
  targetGuests: number | null | undefined,
  limit = 4,
): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const party = Number(targetGuests);
  if (!Number.isFinite(party) || party <= 0) {
    return items.slice(0, limit);
  }
  const fits: T[] = [];
  const smaller: T[] = [];
  for (const item of items) {
    const g = Number(item.maxGuests ?? item.MaxGuests ?? 0);
    if (!Number.isFinite(g) || g <= 0 || g >= party) {
      fits.push(item);
    } else {
      smaller.push(item);
    }
  }
  return [...fits, ...smaller].slice(0, limit);
}

export function formatSimilarStayPrice(nightlyRate: number, currency = 'INR'): string {
  if (currency === 'INR') {
    return `from ₹${nightlyRate.toLocaleString('en-IN')} / night`;
  }
  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(nightlyRate);
    return `from ${formatted} / night`;
  } catch {
    return `from ₹${nightlyRate.toLocaleString('en-IN')} / night`;
  }
}
