import HostIdentityLabel from '@/components/property/HostIdentityLabel';
import { feePercent } from "../utils/paymentFeeCopy";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { buildApiUrl } from '@/api/client';
import { formatCurrency } from '@/utils/formatting'; // TASK-1872
import { getFavoriteIds, toggleFavorite } from '@/utils/guestHistory'; // TASK-1873
import OptimizedImage from '@/components/ui/OptimizedImage'; // TASK-1874
import SkeletonCard from '@/components/apartments/SkeletonCard'; // TASK-1875
import SEO from '@/components/SEO'; // TASK-1876
import MultiPinMap, { type MapPin } from '@/components/map/MultiPinMap'; // TL-PROP
import { useMarketplaceCardPrices, type MarketplaceCardPrice } from '@/hooks/useMarketplaceCardPrices'; // TASK-10298999
import { sizedForPartyFirst } from '@/utils/smallParty'; // GUEST-033
import { allInTotalLabel, directSavingsLabel } from '@/utils/directBookingPrice';
import AirbnbSearchBar from '@/components/marketplace/airbnbSearch/AirbnbSearchBar';
import { buildHomeUnitPath, getPropertySlug } from '@/utils/navigation';
import { getListingDisplayName } from '@/lib/listingDisplayName';
import { sanitizeGuestImageUrl } from '@/utils/guestImageUrl';
import { enrichMarketplaceCoverItems } from '@/utils/marketplaceListingCover';
import ReviewSummary from '@/components/ReviewSummary'; // TASK-4511
import OwnerShareBadge from '@/components/OwnerShareBadge'; // TASK-4511
import AmenityFilterPills from '@/components/marketplace/AmenityFilterPills';
import { matchesAmenityFilter, serverAmenityCodesFor } from '@/utils/amenityFilters';
import { resolveAmenityLabel } from '@/utils/amenityCodes';
import { isHostelDormType } from '@/utils/dormListing';
import { hasOnlinePaymentRail } from '@/tenant/paymentRail';
import { getPublicSiteOrigin } from '@/config/siteOrigin';
import { MARKETPLACE_BRAND_BASELINE } from '@/tenant/displayBrand';

// TL-PROP: shape from GET /marketplace/properties (powers the map view).
type MarketplacePropertyApi = {
  propertyId: number;
  listingId: number;
  tenantSlug?: string;
  propertyName: string;
  propertyAddress?: string | null;
  listingName: string;
  latitude?: number | null;
  longitude?: number | null;
};

type MarketplaceItem = {
  hostIdentityVerified?: unknown;
  id: number;
  tenantSlug: string;
  tenantName: string;
  tenantCategory?: string;
  title: string;
  displayName?: string | null;
  publicTitle?: string | null;
  nameFormatted?: string | null;
  name?: string | null;
  city?: string;
  pricePerNight: number;
  maxGuests: number;
  coverImageUrl?: string;
  slug: string;
  // TASK-1873: rating + reviewCount for parity with ListingCard
  rating?: number | null;
  reviewCount?: number | null;
  // TASK-4511: Trust signals
  hasVerifiedPhotos?: boolean;
  isGstRegistered?: boolean;
  // TASK-10089: source-aware review provenance from GET /marketplace/listings.
  // verifiedStayCount = native completed stays verified by Atlas (only these may
  // render "verified"); externalReviewCount = imported feedback (Google etc.).
  verifiedStayCount?: number | null;
  externalReviewCount?: number | null;
  // MKT-012: dominant source name and sourceUrl gate for imported reviews
  externalReviewSource?: string | null;
  externalReviewSourceUrl?: string | null;
  // MKT-001: server-derived per-tenant payment routing (TenantsController/IPaymentRoutingService).
  // Missing metadata must remain unknown, without a platform-wide percentage fallback.
  chargesOnlinePaymentFee?: boolean;
  convenienceFeePercent?: number;
  // TASK-10298932: Amenity filtering support
  amenityCodes?: string[];
  amenities?: (string | { code?: string; name?: string; title?: string })[];
  description?: string;
  propertyType?: string | null;
  accommodationType?: string | null;
  category?: string | null;
};

/**
 * TASK-1039954: Resolves property type badge ("Homestay", "Villa", "B&B", "Hostel", "Hotel")
 * for marketplace property cards with clean tag alignment.
 */
export function resolvePropertyTypeBadge(item: {
  propertyType?: string | null;
  accommodationType?: string | null;
  category?: string | null;
  title?: string | null;
  name?: string | null;
}): string {
  const raw = `${item.propertyType || ''} ${item.category || ''} ${item.accommodationType || ''}`.toLowerCase();
  if (raw.includes('hostel') || raw.includes('dorm') || isHostelDormType(item.accommodationType)) return 'Hostel';
  if (raw.includes('villa')) return 'Villa';
  if (raw.includes('b&b') || raw.includes('bnb') || raw.includes('bed & breakfast') || raw.includes('bed and breakfast') || raw.includes('guesthouse') || raw.includes('guest house')) return 'B&B';
  if (raw.includes('hotel') || raw.includes('resort')) return 'Hotel';
  if (raw.includes('homestay') || raw.includes('apartment') || raw.includes('home') || raw.includes('cottage') || raw.includes('studio')) return 'Homestay';

  const text = `${item.title || ''} ${item.name || ''}`.toLowerCase();
  if (text.includes('hostel') || text.includes('dorm')) return 'Hostel';
  if (text.includes('villa')) return 'Villa';
  if (text.includes('b&b') || text.includes('bnb')) return 'B&B';
  if (text.includes('hotel')) return 'Hotel';

  return 'Homestay';
}

/**
 * TASK-10299086: Resolves guest-facing display name for marketplace listing cards.
 * Prefers listing.displayName / listing.title / listing.nameFormatted over internal slug/code,
 * and maps internal Atlas SKU codes (e.g. Atlas101 -> Studio 101, Atlas501_PH -> Penthouse 501)
 * using getListingDisplayName.
 */
export function resolveMarketplaceListingDisplayName(item: {
  id?: number | string | null;
  title?: string | null;
  displayName?: string | null;
  publicTitle?: string | null;
  nameFormatted?: string | null;
  name?: string | null;
  slug?: string | null;
}): string {
  const explicitGuestName =
    item.displayName?.trim() ||
    item.publicTitle?.trim() ||
    item.nameFormatted?.trim();
  const rawFallback = item.title?.trim() || item.name?.trim() || item.slug?.trim() || '';
  const candidate = explicitGuestName || rawFallback;
  const resolved = getListingDisplayName(item.id, candidate, explicitGuestName || undefined);
  return resolved || candidate || 'Listing';
}

export function marketplaceListingPath(
  item: Pick<MarketplaceItem, 'id' | 'title' | 'tenantSlug'> & {
    displayName?: string | null;
    publicTitle?: string | null;
    nameFormatted?: string | null;
    name?: string | null;
    slug?: string | null;
  },
  searchSuffix = '',
): string {
  // TASK-10299207: build the route slug from the raw listing name (`item.title` / `item.name`),
  // never the humanised display name ("Suite 202"), so the link matches `acceptablePropertySlugs`
  // and `functions/sitemap.xml.ts` (`/homes/atlas202/4?tenant=atlas`).
  const rawSlugSource =
    item.title?.trim() || item.name?.trim() || resolveMarketplaceListingDisplayName(item);
  const propertySlug = getPropertySlug({ property_name: rawSlugSource });
  const base = buildHomeUnitPath(propertySlug, item.id);
  // TASK-102058: carry the active search criteria forward into the details URL
  // (mirrors SearchPage's querySuffix). Without this the details page hydrates
  // default dates/guests, its back-to-results link is null, and Back-navigation
  // restores the grid but the booking context is already lost.
  const p = new URLSearchParams(searchSuffix);
  p.set('tenant', item.tenantSlug);
  return `${base}?${p.toString()}`;
}

// TASK-10089: source-aware provenance labels. "Verified" applies ONLY to completed
// stays verified by Atlas; imported feedback is labelled by its source. Zero/absent
// counts render nothing — never "0 verified stays", never a fabricated claim.
export function formatVerifiedStaysLabel(count?: number | null): string | null {
  if (count == null || count <= 0) return null;
  return count === 1 ? '1 verified stay' : `${count} verified stays`;
}

// MKT-012 / MKT-015: external review count labelled by its real dominant source, e.g. "54 reviews on Airbnb".
// Says "Google" only when the source is Google. Normalizes raw sync source codes (e.g. "AtlasSyncBookingCom" -> "Booking.com")
// and still renders the provenance label as plain text when sourceUrl is null/empty.
export function normalizeExternalReviewSourceName(source?: string | null): string {
  const raw = source?.trim() || 'Google';
  const lower = raw.toLowerCase();
  if (
    lower === 'atlassyncbookingcom' ||
    lower === 'booking_com' ||
    lower === 'booking.com' ||
    lower === 'bookingcom'
  ) {
    return 'Booking.com';
  }
  if (lower === 'airbnb') return 'Airbnb';
  if (lower === 'google') return 'Google';
  return raw;
}

export function formatExternalReviewsLabel(
  count?: number | null,
  source?: string | null,
  _sourceUrl?: string | null,
): string | null {
  if (count == null || count <= 0) return null;

  const normalizedSource = normalizeExternalReviewSourceName(source);
  if (normalizedSource.toLowerCase() === 'google') {
    return count === 1 ? '1 Google review' : `${count} Google reviews`;
  }
  return count === 1 ? `1 review on ${normalizedSource}` : `${count} reviews on ${normalizedSource}`;
}

type ApiResponse = { items: MarketplaceItem[]; total: number; page: number; pageSize: number };

// TASK-101491: the grid requests one page at a time and appends. This constant is the request
// size, NOT a ceiling on what the page can show - everything past it is reachable via the
// "Show more homes" control below. Do not "fix" a truncated grid by raising this: that just
// moves the cliff and pulls every listing + cover image on first paint.
const PAGE_SIZE = 20;

export type MarketplaceSortOption = 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';

export default function MarketplaceHomepage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // TASK-102711: a failed fetch used to fall into the "No stays match these filters" empty state,
  // telling a guest the marketplace was empty during an API blip. Track it separately + retry.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // TASK-101491: server-reported total + progressive paging state. Before this, the component
  // fetched page 1 only and rendered no pager, so with 27 marketplace-visible listings the last 7
  // were unreachable by any in-page route - silently, with no truncation notice.
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // TASK-1873: save-heart state keyed by listing id
  const [favEpoch, setFavEpoch] = useState(0);
  const favIds = useMemo(() => {
    void favEpoch;
    return new Set(getFavoriteIds());
  }, [favEpoch]);
  // TL-PROP: map view of all marketplace properties. Toggle to show/hide.
  const [showMap, setShowMap] = useState(false);
  const [marketplaceProperties, setMarketplaceProperties] = useState<MarketplacePropertyApi[]>([]);
  // TASK-4413: read dates and guest count from URL params (from AirbnbSearchBar)
  const [searchParams, setSearchParams] = useSearchParams();

  // TASK-1039950: sync category and amenity filter pills with URL query parameters
  const categoryParam = searchParams.get('category')?.toLowerCase();
  const [category, setCategory] = useState<'all' | 'homes' | 'rooms' | 'villas'>(
    categoryParam === 'homes' || categoryParam === 'rooms' || categoryParam === 'villas' ? categoryParam : 'all',
  );

  // MKT-023 / TASK-1039950: Quick amenity filter selection synced with ?amenity= and ?amenities=
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(
    searchParams.get('amenity')?.trim() || searchParams.get('amenities')?.trim() || null,
  );

  // TASK-1039952: sort dropdown options ("Recommended" | "Price: Low to High" | "Price: High to Low" | "Rating: High to Low")
  const sortParam = searchParams.get('sort') || searchParams.get('sortBy');
  const [sortBy, setSortBy] = useState<MarketplaceSortOption>(
    sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'rating_desc'
      ? sortParam
      : 'recommended',
  );

  useEffect(() => {
    const cat = searchParams.get('category')?.toLowerCase();
    if (cat === 'homes' || cat === 'rooms' || cat === 'villas') {
      setCategory(cat);
    } else {
      setCategory('all');
    }
    const amen = searchParams.get('amenity')?.trim() || searchParams.get('amenities')?.trim() || null;
    setSelectedAmenity(amen);

    const s = searchParams.get('sort') || searchParams.get('sortBy');
    if (s === 'price_asc' || s === 'price_desc' || s === 'rating_desc') {
      setSortBy(s);
    } else {
      setSortBy('recommended');
    }
  }, [searchParams]);

  const handleCategoryChange = useCallback((c: 'all' | 'homes' | 'rooms' | 'villas') => {
    setCategory(c);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (c !== 'all') {
        next.set('category', c);
      } else {
        next.delete('category');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleAmenityChange = useCallback((amenity: string | null) => {
    setSelectedAmenity(amenity);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (amenity) {
        next.set('amenity', amenity);
        next.set('amenities', amenity);
      } else {
        next.delete('amenity');
        next.delete('amenities');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleSortChange = useCallback((newSort: string) => {
    const valid: MarketplaceSortOption =
      newSort === 'price_asc' || newSort === 'price_desc' || newSort === 'rating_desc'
        ? newSort
        : 'recommended';
    setSortBy(valid);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (valid !== 'recommended') {
        next.set('sort', valid);
        next.set('sortBy', valid);
      } else {
        next.delete('sort');
        next.delete('sortBy');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // TASK-102058: the criteria the grid was filtered by, forwarded into every property
  // link (cards + map pins) so details hydrates and Back-navigation restores the bar.
  const searchSuffix = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of [
      'city',
      'destination',
      'checkIn',
      'checkOut',
      'guests',
      'adults',
      'children',
      'infants',
      'pets',
      'category',
      'amenity',
      'amenities',
      'sort',
      'sortBy',
      // MKT-031: marketplace brand switch (QA/preview) + campaign attribution survive the click-through
      'brand',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ]) {
      const v = searchParams.get(k);
      if (v != null && v !== '') p.set(k, v);
    }
    return p.toString();
  }, [searchParams]);
  // TASK-4413 / MKT-016: price-range control — forwarded as minPrice/maxPrice query params to
  // GET /marketplace/listings so server-side filtering and pagination work across all pages,
  // while keeping the client-side filter as a safety net.
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');

  const minPrice = useMemo(() => {
    const n = Number(minPriceInput);
    return minPriceInput.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [minPriceInput]);
  const maxPrice = useMemo(() => {
    const n = Number(maxPriceInput);
    return maxPriceInput.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [maxPriceInput]);

  // TASK-101491: the FILTER half of the query only - deliberately excludes page/pageSize so that
  // changing a filter produces a new key (resetting paging) while paging does not re-trigger the
  // first-page effect.
  const serverAmenityCodes = useMemo(() => serverAmenityCodesFor(selectedAmenity), [selectedAmenity]);
  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== 'all') p.set('category', category);
    if (query.trim()) p.set('city', query.trim());
    // TASK-4413 / MKT-022: pass date/guest/destination filters to API if present
    const city = searchParams.get('city') || searchParams.get('destination');
    if (city?.trim()) p.set('city', city.trim());
    const checkIn = searchParams.get('checkIn');
    if (checkIn) p.set('checkIn', checkIn);
    const checkOut = searchParams.get('checkOut');
    if (checkOut) p.set('checkOut', checkOut);
    const guests = searchParams.get('guests');
    if (guests) p.set('guests', guests);
    if (minPrice != null) p.set('minPrice', String(minPrice));
    if (maxPrice != null) p.set('maxPrice', String(maxPrice));
    // MKT-026: the server filters on real amenity codes before pagination, so page 2+ is filtered too.
    if (serverAmenityCodes.length > 0) p.set('amenities', serverAmenityCodes.join(','));
    return p.toString();
  }, [category, query, searchParams, minPrice, maxPrice, serverAmenityCodes]);

  const buildPagePath = useCallback(
    (pageNumber: number) => {
      const p = new URLSearchParams(filterQuery);
      p.set('page', String(pageNumber));
      p.set('pageSize', String(PAGE_SIZE));
      return `/marketplace/listings?${p.toString()}`;
    },
    [filterQuery],
  );

  // TASK-101875: generation token for the "Show more homes" race. The page-1 effect above
  // already guards with `cancelled`, but `loadMore` had none — a filter change while page N+1
  // was in flight let the stale response append old-filter listings and rewind `page`.
  const activeFilterRef = useRef(filterQuery);
  useEffect(() => {
    activeFilterRef.current = filterQuery;
  }, [filterQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setPage(1);
    fetch(buildApiUrl(buildPagePath(1)))
      .then(async (r) => {
        if (!r.ok) throw new Error(`marketplace listings ${r.status}`);
        return (await r.json()) as ApiResponse;
      })
      .then(async (data) => {
        const enriched = await enrichMarketplaceCoverItems(data.items ?? []);
        if (cancelled) return;
        setItems(enriched);
        // TASK-101491: trust the server's count. Note the API returns the CURRENT PAGE's match
        // count (not a global one) when a `city` filter is applied - city filtering happens after
        // the page slice server-side - so this correctly yields no "show more" for city searches
        // rather than a button that fetches nothing.
        setTotal(typeof data.total === 'number' ? data.total : enriched.length);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildPagePath, reloadKey]);

  // TASK-101491: everything the server said exists but we have not fetched yet.
  const hasMore = !loading && items.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    const requestFilter = filterQuery;
    setLoadingMore(true);
    fetch(buildApiUrl(buildPagePath(next)))
      .then(async (r) => (r.ok ? ((await r.json()) as ApiResponse) : null))
      .then(async (data) => {
        if (!data) return;
        // TASK-101875: discard a stale next-page response when the filter changed while it
        // was in flight. The page-1 effect has already reset items/page/total for the new
        // filter, so appending here would mix old-filter listings into the fresh grid and
        // desynchronise `page` for the next request.
        if (activeFilterRef.current !== requestFilter) return;
        const enriched = await enrichMarketplaceCoverItems(data.items ?? []);
        const seen = new Set(items.map((i) => i.id));
        const fresh = enriched.filter((i) => !seen.has(i.id));
        if (fresh.length === 0) {
          // Ranking is score-based and can shift between requests, so a page can come back
          // entirely deduped. Settle the total to what we actually hold rather than leaving a
          // button that can never add anything.
          setTotal(items.length);
          return;
        }
        setItems((prev) => [...prev, ...fresh]);
        setPage(next);
      })
      .catch(() => {
        /* keep what is already rendered; the control stays available for a retry */
      })
      .finally(() => setLoadingMore(false));
  }, [buildPagePath, filterQuery, hasMore, items, loadingMore, page]);

  // TASK-10298999: one checkout quote per card, for the searched dates when given (tonight otherwise).
  const cardStay = useMemo(() => {
    const g = Number(searchParams.get('guests'));
    return {
      checkIn: searchParams.get('checkIn'),
      checkOut: searchParams.get('checkOut'),
      guests: Number.isFinite(g) && g > 0 ? Math.floor(g) : null,
    };
  }, [searchParams]);
  const cardPrices = useMarketplaceCardPrices(items, cardStay);

  const visibleItems = useMemo(() => {
    let result = items;

    // TASK-1039952 / TASK-1039951: get calculated display/quoted price for listing
    const getItemPrice = (item: MarketplaceItem): number => {
      const cardPrice = cardPrices.get(item.id);
      if (cardPrice && cardPrice.status === 'ready' && cardPrice.display.realNightly != null) {
        return cardPrice.display.realNightly;
      }
      return item.pricePerNight;
    };

    if (category !== 'all') {
      result = result.filter((item) => {
        const cat = resolvePropertyTypeBadge(item).toLowerCase();
        if (category === 'homes') return cat === 'homestay' || cat === 'home' || cat === 'villa';
        if (category === 'rooms') return cat === 'room' || cat === 'hotel' || cat === 'b&b' || cat === 'hostel';
        if (category === 'villas') return cat === 'villa' || (item.title && item.title.toLowerCase().includes('villa'));
        return true;
      });
    }

    if (minPrice != null || maxPrice != null) {
      result = result.filter((item) => {
        // TASK-1039951: Price range filtering qualifies positive rates only and uses calculated display/quoted price
        const price = getItemPrice(item);
        if (typeof price !== 'number' || price <= 0) return false;
        if (minPrice != null && price < minPrice) return false;
        if (maxPrice != null && price > maxPrice) return false;
        return true;
      });
    }

    if (selectedAmenity) {
      // MKT-026: when this pill maps to master codes AND the item carries amenityCodes (a current
      // API), match those exact codes - the same set the server filtered on, so nothing the server
      // returned is dropped and a non-filtering API is still caught. The title/text guess is kept
      // only for an older API (no amenityCodes) or a client-only pill (Pet Friendly).
      result = result.filter((item) =>
        serverAmenityCodes.length > 0 && Array.isArray(item.amenityCodes)
          ? item.amenityCodes.some((c) => typeof c === 'string' && serverAmenityCodes.includes(c.trim().toLowerCase()))
          : matchesAmenityFilter(item, selectedAmenity),
      );
    }

    if (sortBy === 'price_asc') {
      return [...result].sort((a, b) => getItemPrice(a) - getItemPrice(b));
    }
    if (sortBy === 'price_desc') {
      return [...result].sort((a, b) => getItemPrice(b) - getItemPrice(a));
    }
    if (sortBy === 'rating_desc') {
      return [...result].sort((a, b) => {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      });
    }

    // GUEST-033: a 1-2 guest search lists homes sized for them first (stable; no change for 3+ guests).
    return sizedForPartyFirst(result, cardStay.guests);
  }, [items, category, minPrice, maxPrice, selectedAmenity, serverAmenityCodes, cardStay.guests, sortBy, cardPrices]);

  // TASK-4511: honest trust-strip numbers — derived entirely from the real /marketplace/listings
  // response already fetched above. No fabricated/urgency copy.
  const verifiedHomesCount = useMemo(
    () => items.filter((item) => item.hasVerifiedPhotos).length,
    [items],
  );

  // TL-PROP / MKT-020: fetch the canonical marketplace properties endpoint for map pins,
  // forwarding active city/location, checkIn, checkOut, and guests query parameters.
  const propertiesQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('pageSize', '200');
    const activeCity =
      query.trim() ||
      searchParams.get('city')?.trim() ||
      searchParams.get('destination')?.trim() ||
      '';
    if (activeCity) p.set('location', activeCity);
    const checkIn = searchParams.get('checkIn');
    if (checkIn) p.set('checkIn', checkIn);
    const checkOut = searchParams.get('checkOut');
    if (checkOut) p.set('checkOut', checkOut);
    const guests = searchParams.get('guests');
    if (guests) p.set('guests', guests);
    return p.toString();
  }, [query, searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch(buildApiUrl(`/marketplace/properties?${propertiesQuery}`))
      .then(async (r) => (r.ok ? ((await r.json()) as MarketplacePropertyApi[]) : []))
      .then((rows) => {
        if (cancelled) return;
        setMarketplaceProperties(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setMarketplaceProperties([]);
      });
    return () => {
      cancelled = true;
    };
  }, [propertiesQuery]);

  // TASK-102058 / MKT-020: pin hrefs carry the active search criteria, and mapPins
  // intersects with active city, price, and category filters so Map (N) matches active filters.
  const mapPins = useMemo(() => {
    const activeCityFilter = (
      query.trim() ||
      searchParams.get('city')?.trim() ||
      searchParams.get('destination')?.trim() ||
      ''
    ).toLowerCase();
    const hasPriceOrCategoryFilter =
      minPrice != null || maxPrice != null || category !== 'all';
    const visibleListingIds = new Set(visibleItems.map((item) => item.id));
    const allLoadedListingIds = new Set(items.map((item) => item.id));

    const seen = new Map<number, MapPin>();
    for (const row of marketplaceProperties) {
      if (row.latitude == null || row.longitude == null) continue;
      if (seen.has(row.propertyId)) continue;

      if (activeCityFilter) {
        const rowText = `${row.propertyName ?? ''} ${row.propertyAddress ?? ''} ${row.listingName ?? ''}`.toLowerCase();
        const matchesCityText = rowText.includes(activeCityFilter);
        const matchesVisibleListing = visibleListingIds.has(row.listingId);
        if (allLoadedListingIds.has(row.listingId)) {
          if (!matchesVisibleListing && !matchesCityText) continue;
        } else if (!matchesCityText && !matchesVisibleListing) {
          continue;
        }
      }

      if (hasPriceOrCategoryFilter && !loading) {
        if (!visibleListingIds.has(row.listingId)) continue;
      }

      seen.set(row.propertyId, {
        id: `mp-${row.propertyId}`,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        title: row.propertyName || row.listingName || `Property ${row.propertyId}`,
        subtitle: row.propertyAddress ?? undefined,
        href: row.tenantSlug
          ? marketplaceListingPath(
              {
                id: row.listingId,
                title: row.listingName || row.propertyName || `Listing ${row.listingId}`,
                tenantSlug: row.tenantSlug,
              },
              searchSuffix,
            )
          : buildHomeUnitPath(getPropertySlug({ property_name: row.listingName }), row.listingId),
      });
    }
    return Array.from(seen.values());
  }, [
    category,
    items,
    loading,
    marketplaceProperties,
    maxPrice,
    minPrice,
    query,
    searchParams,
    searchSuffix,
    visibleItems,
  ]);

  return (
    <>
    <section className="mx-auto w-full max-w-6xl px-4 py-8" data-testid="marketplace-homepage">
      {/* TASK-1876: SEO meta for marketplace homepage.
          TASK-101960: self-referencing absolute canonical + og:site_name pinned to the
          shipped brand baseline (MARKETPLACE_BRAND_BASELINE), mirroring Home.tsx's
          getPublicSiteOrigin() canonical pattern. */}
      {/* MKT-002: `Listings.PhotosVerifiedAt` is unset on 0 of 136 prod listings — "Verified"
          copy here asserted a verification that has never happened. */}
      <SEO
        title="Atlastays Marketplace — Homes & rooms across India, book direct"
        description="Discover homes and rooms across India on Atlastays. Direct booking from the owner."
        url={`${getPublicSiteOrigin()}/`}
        siteName={MARKETPLACE_BRAND_BASELINE}
      />
      <h1 className="text-3xl font-bold text-text-primary">Atlastays Marketplace</h1>
      {/* TASK-101317 / MKT-002: no verification is required to list here, so never claim "verified hosts".
          Matches the SEO description, which MKT-002 already corrected. */}
      <p className="mt-2 text-text-body">Discover homes and rooms across India. Book direct with the owner.</p>

      {/* TASK-4511: trust strip — real computed numbers only, no fabricated stats/urgency. */}
      {!loading && items.length > 0 && (
        <div
          data-testid="marketplace-trust-strip"
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted"
        >
          {/* MKT-002: `Listings.PhotosVerifiedAt` is unset on 0 of 136 prod listings today, so
              this item would always read "0 Verified homes" — an unearned trust claim. Omit it
              entirely rather than show a zero; it reappears the moment any listing is verified. */}
          {verifiedHomesCount > 0 && (
            <>
              <span>{verifiedHomesCount} Verified homes</span>
              <span aria-hidden>·</span>
            </>
          )}
          {/* TASK-101491: the server's total, not the number loaded so far - this read "20
              listings" while the API reported 27. `verifiedHomesCount` above stays a count of
              LOADED items on purpose: it is a trust signal, and undercounting it is the safe
              direction (never claim verification we have not observed). */}
          <span>{total || items.length} listings</span>
          <span aria-hidden>·</span>
          <span className="font-medium text-emerald-700">Book direct from the owner</span>
          {hasOnlinePaymentRail() ? (
            <>
              <span aria-hidden>·</span>
              <span>Any payment-processing fee is shown before payment</span>
            </>
          ) : null}
        </div>
      )}

      <div className="mt-8">
        <AirbnbSearchBar />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          data-testid="marketplace-search"
          className="min-h-[44px] rounded-xl border border-border px-4 py-2"
          placeholder="Search by city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(['all', 'homes', 'rooms', 'villas'] as const).map((c) => (
          <button
            key={c}
            data-testid={`marketplace-filter-${c}`}
            className={`min-h-[44px] rounded-xl px-4 py-2 ${category === c ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}
            onClick={() => handleCategoryChange(c)}
          >
            {c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
        {/* TL-PROP: map view toggle. Hidden if no properties have lat/lng configured. */}
        {mapPins.length > 0 && (
          <button
            data-testid="marketplace-map-toggle"
            className={`ml-auto min-h-[44px] rounded-xl px-4 py-2 ${showMap ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}
            onClick={() => setShowMap((v) => !v)}
            aria-pressed={showMap}
          >
            {showMap ? 'Hide map' : `Map (${mapPins.length})`}
          </button>
        )}
      </div>

      {/* MKT-023 / TASK-10298932 / TASK-1039950: Top amenities quick filter pills */}
      <AmenityFilterPills
        selectedAmenity={selectedAmenity}
        onSelectAmenity={handleAmenityChange}
      />

      {/* TASK-4413: price-range control & TASK-1039952: sort dropdown */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="marketplace-min-price" className="text-sm font-medium text-text-muted">
            Price / night
          </label>
          <input
            id="marketplace-min-price"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Min"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            className="min-h-[40px] w-24 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          <span aria-hidden className="text-text-muted">–</span>
          <input
            id="marketplace-max-price"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Max"
            aria-label="Max price"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            className="min-h-[40px] w-24 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          {(minPriceInput !== '' || maxPriceInput !== '') && (
            <button
              type="button"
              onClick={() => {
                setMinPriceInput('');
                setMaxPriceInput('');
              }}
              className="min-h-[40px] rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-bg-muted"
            >
              Clear price
            </button>
          )}
        </div>

        {/* TASK-1039952: Missing sort dropdown on Marketplace Homepage */}
        <div className="flex items-center gap-2" data-testid="marketplace-sort-wrapper">
          <label htmlFor="marketplace-sort" className="text-sm font-medium text-text-muted whitespace-nowrap">
            Sort by:
          </label>
          <select
            id="marketplace-sort"
            data-testid="marketplace-sort-select"
            aria-label="Sort listings"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="min-h-[40px] rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Rating: High to Low</option>
          </select>
        </div>
      </div>

      {showMap && mapPins.length > 0 && (
        <div className="mt-6">
          <MultiPinMap pins={mapPins} height={400} />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="marketplace-grid">
        {/* TASK-1875: skeleton cards while loading */}
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading &&
          visibleItems.map((item) => {
            const isFav = favIds.has(item.id);
            const cardTitle = resolveMarketplaceListingDisplayName(item);
            const canonicalUrl = marketplaceListingPath(item, searchSuffix);

            return (
              <article
                key={item.id}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-sm transition-all hover:border-border-subtle hover:shadow-md cursor-pointer"
                data-testid="marketplace-card"
                onClick={() => navigate(canonicalUrl)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    navigate(canonicalUrl);
                  }
                }}
              >
                {/* TASK-1874: OptimizedImage replaces raw <img> */}
                <div className="h-40 w-full bg-bg-muted">
                  <OptimizedImage
                    src={sanitizeGuestImageUrl(item.coverImageUrl) ?? ''}
                    alt={cardTitle || 'Listing photo'}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>

                {/* TASK-1873: save heart */}
                <button
                  type="button"
                  aria-label={isFav ? 'Remove from saved' : 'Save listing'}
                  className="absolute right-2 top-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-bg-surface/95 p-2 shadow border border-border-subtle hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.id);
                    setFavEpoch((prev) => prev + 1);
                  }}
                >
                  {isFav
                    ? <FaHeart className="h-4 w-4 text-red-500" aria-hidden />
                    : <FaRegHeart className="h-4 w-4 text-text-muted" aria-hidden />}
                </button>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="text-xs uppercase tracking-wide text-text-muted">{item.tenantName}</div>
                  <h2 className="text-base font-semibold text-text-primary leading-snug">
                    <Link
                      to={canonicalUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline focus:outline-none"
                    >
                      {cardTitle}
                    </Link>
                  </h2>
                  <HostIdentityLabel marketplace verified={item.hostIdentityVerified} />

                  {/* TASK-4511: Trust signal badges */}
                  {(item.hasVerifiedPhotos || item.isGstRegistered) && (
                    <div className="flex flex-wrap gap-1">
                      {item.hasVerifiedPhotos && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full" title="Verified photos">
                          ✓ Verified photos
                        </span>
                      )}
                      {item.isGstRegistered && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full" title="GST registered">
                          ✓ GST registered
                        </span>
                      )}
                    </div>
                  )}

                  {/* TASK-1039954: Aligned property type badge and amenity chips */}
                  {(() => {
                    const propertyTypeBadge = resolvePropertyTypeBadge(item);
                    const isHostel = propertyTypeBadge === 'Hostel' || isHostelDormType(item.accommodationType);
                    const rawAmenities: string[] = [
                      ...(Array.isArray(item.amenityCodes) ? item.amenityCodes : []),
                      ...(Array.isArray(item.amenities)
                        ? item.amenities.map((a) => (typeof a === 'string' ? a : a.title || a.name || a.code || ''))
                        : []),
                    ].filter(Boolean);
                    const amenityChips = Array.from(
                      new Set(
                        rawAmenities
                          .map((c) => resolveAmenityLabel(c))
                          .filter((l): l is string => Boolean(l)),
                      ),
                    ).slice(0, 3);

                    return (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5" data-testid="marketplace-card-tags">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200"
                            data-testid="property-type-badge"
                          >
                            {propertyTypeBadge}
                          </span>
                          {item.city && (
                            <span className="w-fit rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary" data-testid="marketplace-city-badge">
                              {item.city}
                            </span>
                          )}
                          {amenityChips.map((chip) => (
                            <span
                              key={chip}
                              className="inline-flex items-center gap-1 rounded-md bg-neutral-50 border border-neutral-200/80 px-2 py-0.5 text-xs text-neutral-600"
                              data-testid="marketplace-amenity-chip"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                        {isHostel && (
                          <span
                            className="inline-flex items-center self-start rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                            data-testid="hostel-per-bed-indicator"
                          >
                            Starting from per bed
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  <p className="text-sm text-text-body">Sleeps up to {item.maxGuests} guest{item.maxGuests === 1 ? '' : 's'}</p>

                  {/* TASK-1873 / TASK-10298776: rating row — enforce >= 4★ suppression guard */}
                  {item.rating != null && item.rating >= 4 && (item.reviewCount == null || item.reviewCount > 0) && (
                    <p className="text-sm font-medium text-[var(--accent-text)]">
                      {'★'.repeat(Math.round(item.rating))}
                      <span className="ml-1 text-text-muted">{item.rating.toFixed(1)}</span>
                      {item.reviewCount != null && item.reviewCount > 0 && (
                        <span className="ml-1 text-text-muted">({item.reviewCount})</span>
                      )}
                    </p>
                  )}

                  {/* TASK-10089 / MKT-012 / MKT-015: review provenance — verified stays and external reviews are
                      distinct labels from distinct counts. External-only cards (no
                      verifiedStayCount) never claim a verified stay. Renders as an outbound link
                      when externalReviewSourceUrl is present, and as plain text when null/empty. */}
                  {(() => {
                    const verifiedLabel = formatVerifiedStaysLabel(item.verifiedStayCount);
                    const externalLabel = formatExternalReviewsLabel(
                      item.externalReviewCount,
                      item.externalReviewSource,
                      item.externalReviewSourceUrl,
                    );
                    if (!verifiedLabel && !externalLabel) return null;
                    const trimmedSourceUrl = item.externalReviewSourceUrl?.trim() ?? '';
                    const hasValidExternalUrl = /^https?:\/\//i.test(trimmedSourceUrl);
                    return (
                      <p className="text-xs text-text-muted" data-testid="marketplace-review-provenance">
                        {verifiedLabel && (
                          <span data-testid="marketplace-verified-stays">{verifiedLabel}</span>
                        )}
                        {verifiedLabel && externalLabel && <span aria-hidden> · </span>}
                        {externalLabel && (
                          hasValidExternalUrl ? (
                            <a
                              href={trimmedSourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="underline hover:text-text-primary"
                              data-testid="marketplace-external-reviews"
                            >
                              {externalLabel}
                            </a>
                          ) : (
                            <span data-testid="marketplace-external-reviews">{externalLabel}</span>
                          )
                        )}
                      </p>
                    );
                  })()}

                  {/* TASK-4511: keyword-bucketed sentiment chip — matches SearchPage.tsx card treatment.
                      TASK-10089: gated on provenance agreement — the chip (native reviews only)
                      renders only when the summary's verified-stay count agrees with the card. */}
                  <ReviewSummary listingId={item.id} verifiedStayCount={item.verifiedStayCount} />

                  {/* TASK-10298999 (founder ruling 2026-10-21: price shown = price charged): the card reads the
                      same checkout quote as the listing page and the booking box — never the listing's
                      standard rate plus a client-side fee estimate. */}
                  <MarketplaceCardPriceBlock price={cardPrices.get(item.id)} />

                  {/* TASK-4511: Owner-share trust badge — no nightlyPrice prop (matches SearchPage.tsx's
                      BUG-7 fix; avoids leaking a fabricated host payout figure). */}
                  <OwnerShareBadge className="self-start" processingFeePercent={item.chargesOnlinePaymentFee === false ? 0 : feePercent(item.convenienceFeePercent)} />

                  <Link
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                    to={canonicalUrl}
                    onClick={(e) => e.stopPropagation()}
                  >
                    View home
                  </Link>
                </div>
              </article>
            );
          })}
      </div>

      {/* TASK-101491: progressive loading. An explicit control rather than infinite scroll -
          the portal targets WCAG-AA, and an auto-appending grid strands keyboard and screen-reader
          users and makes the footer unreachable. */}
      {hasMore && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            data-testid="marketplace-load-more"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-[44px] rounded-xl bg-black px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Show more homes'}
          </button>
          <p className="text-sm text-text-muted" data-testid="marketplace-load-more-count" aria-live="polite">
            Showing {items.length} of {total}
          </p>
        </div>
      )}

      {/* TASK-4309: explicit empty state so a filter/search with no matches shows a
          message instead of a blank gap between the filter bar and the footer.
          TASK-4413: also covers a price filter that narrows the grid to zero results. */}
      {!loading && loadError && (
        <div
          role="alert"
          data-testid="marketplace-load-error"
          className="mt-8 rounded-2xl border border-border bg-bg-surface p-10 text-center"
        >
          <p className="text-base font-semibold text-text-primary">We couldn’t load stays right now</p>
          <p className="mt-1 text-sm text-text-muted">This is a problem on our side, not your filters.</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-4 min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !loadError && visibleItems.length === 0 && (
        <div
          data-testid="marketplace-empty"
          className="mt-8 rounded-2xl border border-dashed border-border bg-bg-surface p-10 text-center"
        >
          <p className="text-base font-semibold text-text-primary">No stays match these filters yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Try the “All” tab or a different city to see available homes and rooms.
          </p>
          <button
            type="button"
            data-testid="marketplace-empty-clear-filters"
            onClick={() => {
              setQuery('');
              setCategory('all');
              setMinPriceInput('');
              setMaxPriceInput('');
              setSelectedAmenity(null);
              setSortBy('recommended');
              setSearchParams({});
            }}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-black px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-gray-800 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </section>
    </>
  );
}

/**
 * TASK-10298999: the marketplace card price, in the same words as the tenant homepage card —
 * struck standard rate, real nightly price, the direct-booking saving and the all-in total.
 * Without a quote it shows no number: a guessed price is exactly what this task removed.
 */
function MarketplaceCardPriceBlock({ price }: { price: MarketplaceCardPrice | undefined }) {
  if (!price || price.status === 'loading') {
    return (
      <p className="text-sm text-text-muted" data-testid="marketplace-card-price-loading">
        Loading price…
      </p>
    );
  }
  if (price.status === 'unavailable') {
    return (
      <p className="text-sm text-text-muted" data-testid="marketplace-card-price-unavailable">
        Choose dates to see the price.
      </p>
    );
  }
  const { display } = price;
  return (
    <div data-testid="marketplace-card-price">
      {display.appliedPromotionLabel && display.savingsPercent > 0 && (
        <span
          className="mb-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
          data-testid="marketplace-card-deal-badge"
        >
          {display.appliedPromotionLabel}
        </span>
      )}
      <p className="text-xl font-bold text-text-primary">
        {display.standardNightly != null && (
          <span
            className="mr-2 text-base font-normal text-text-muted line-through"
            data-testid="marketplace-card-standard-price"
          >
            <span className="sr-only">Standard price </span>
            {formatCurrency(display.standardNightly, { maximumFractionDigits: 0 })}
          </span>
        )}
        <span data-testid="marketplace-card-real-price">
          {formatCurrency(display.realNightly, { maximumFractionDigits: 0 })}
        </span>
        <span className="ml-1 text-sm font-normal text-text-muted">/ night</span>
      </p>
      {display.savingsPercent > 0 && (
        <p className="text-xs font-semibold text-green-700" data-testid="marketplace-card-saving">
          {directSavingsLabel(display.savingsPercent)}
        </p>
      )}
      <p className="text-xs text-text-muted" data-testid="marketplace-card-total">
        {allInTotalLabel(formatCurrency(display.total, { maximumFractionDigits: 0 }), display.nights)}
      </p>
    </div>
  );
}
