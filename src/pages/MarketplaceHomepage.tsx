import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { buildApiUrl } from '@/api/client';
import { formatCurrency } from '@/utils/formatting'; // TASK-1872
import { getFavoriteIds, toggleFavorite } from '@/utils/guestHistory'; // TASK-1873
import OptimizedImage from '@/components/ui/OptimizedImage'; // TASK-1874
import SkeletonCard from '@/components/apartments/SkeletonCard'; // TASK-1875
import SEO from '@/components/SEO'; // TASK-1876
import MultiPinMap, { type MapPin } from '@/components/map/MultiPinMap'; // TL-PROP
import { formatEstTotalInclGst } from '@/utils/guestPriceEstimate';
import AirbnbSearchBar from '@/components/marketplace/airbnbSearch/AirbnbSearchBar';
import { buildHomeUnitPath, getPropertySlug } from '@/utils/navigation';
import { sanitizeGuestImageUrl } from '@/utils/guestImageUrl';
import { enrichMarketplaceCoverItems } from '@/utils/marketplaceListingCover';
import ReviewSummary from '@/components/ReviewSummary'; // TASK-4511
import OwnerShareBadge from '@/components/OwnerShareBadge'; // TASK-4511

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
  id: number;
  tenantSlug: string;
  tenantName: string;
  tenantCategory?: string;
  title: string;
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
};

function marketplaceListingPath(item: Pick<MarketplaceItem, 'id' | 'title' | 'tenantSlug'>): string {
  const propertySlug = getPropertySlug({ property_name: item.title });
  return `${buildHomeUnitPath(propertySlug, item.id)}?tenant=${encodeURIComponent(item.tenantSlug)}`;
}

type ApiResponse = { items: MarketplaceItem[]; total: number; page: number; pageSize: number };

export default function MarketplaceHomepage() {
  const [category, setCategory] = useState<'all' | 'homes' | 'rooms'>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // TASK-1873: save-heart state keyed by listing id
  const [favEpoch, setFavEpoch] = useState(0);
  const favIds = useMemo(() => {
    void favEpoch;
    return new Set(getFavoriteIds());
  }, [favEpoch]);
  // TL-PROP: map view of all marketplace properties. Toggle to show/hide.
  const [showMap, setShowMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  // TASK-4413: read dates and guest count from URL params (from AirbnbSearchBar)
  const [searchParams] = useSearchParams();
  // TASK-4413: price-range control — client-side filter over the fetched grid, mirroring
  // SearchPage.tsx's minPrice/maxPrice pattern. Local state (not URL) — the marketplace
  // grid fetch already covers date/guest/category/city; price narrows the same result set.
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');

  const apiPath = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== 'all') p.set('category', category);
    if (query.trim()) p.set('city', query.trim());
    // TASK-4413: pass date/guest filters to API if present
    const city = searchParams.get('city');
    if (city?.trim()) p.set('city', city.trim());
    const checkIn = searchParams.get('checkIn');
    if (checkIn) p.set('checkIn', checkIn);
    const checkOut = searchParams.get('checkOut');
    if (checkOut) p.set('checkOut', checkOut);
    const guests = searchParams.get('guests');
    if (guests) p.set('guests', guests);
    p.set('page', '1');
    p.set('pageSize', '20');
    return `/marketplace/listings?${p.toString()}`;
  }, [category, query, searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(buildApiUrl(apiPath))
      .then(async (r) => (r.ok ? ((await r.json()) as ApiResponse) : { items: [] as MarketplaceItem[] }))
      .then(async (data) => {
        const enriched = await enrichMarketplaceCoverItems(data.items ?? []);
        if (!cancelled) setItems(enriched);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  // TASK-4413: client-side price filter over the fetched grid, mirroring SearchPage.tsx's
  // minPrice/maxPrice behavior. Applying a price filter does not touch `category` state, so
  // the active category tab selection is preserved.
  const minPrice = useMemo(() => {
    const n = Number(minPriceInput);
    return minPriceInput.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [minPriceInput]);
  const maxPrice = useMemo(() => {
    const n = Number(maxPriceInput);
    return maxPriceInput.trim() !== '' && Number.isFinite(n) ? n : null;
  }, [maxPriceInput]);

  const visibleItems = useMemo(() => {
    if (minPrice == null && maxPrice == null) return items;
    return items.filter((item) => {
      if (minPrice != null && item.pricePerNight < minPrice) return false;
      if (maxPrice != null && item.pricePerNight > maxPrice) return false;
      return true;
    });
  }, [items, minPrice, maxPrice]);

  // TASK-4511: honest trust-strip numbers — derived entirely from the real /marketplace/listings
  // response already fetched above. No fabricated/urgency copy.
  const verifiedHomesCount = useMemo(
    () => items.filter((item) => item.hasVerifiedPhotos).length,
    [items],
  );

  // TL-PROP: separately fetch the canonical marketplace properties endpoint for map pins.
  // Independent of the card grid — different endpoint shape, different fields.
  useEffect(() => {
    let cancelled = false;
    fetch(buildApiUrl('/marketplace/properties?pageSize=200'))
      .then(async (r) => (r.ok ? ((await r.json()) as MarketplacePropertyApi[]) : []))
      .then((rows) => {
        if (cancelled) return;
        const seen = new Map<number, MapPin>();
        for (const row of rows ?? []) {
          if (row.latitude == null || row.longitude == null) continue;
          if (seen.has(row.propertyId)) continue;
          seen.set(row.propertyId, {
            id: `mp-${row.propertyId}`,
            lat: Number(row.latitude),
            lng: Number(row.longitude),
            title: row.propertyName || row.listingName || `Property ${row.propertyId}`,
            subtitle: row.propertyAddress ?? undefined,
            href: row.tenantSlug
              ? marketplaceListingPath({
                  id: row.listingId,
                  title: row.listingName || row.propertyName || `Listing ${row.listingId}`,
                  tenantSlug: row.tenantSlug,
                })
              : buildHomeUnitPath(getPropertySlug({ property_name: row.listingName }), row.listingId),
          });
        }
        setMapPins(Array.from(seen.values()));
      })
      .catch(() => {
        if (!cancelled) setMapPins([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8" data-testid="marketplace-homepage">
      {/* TASK-1876: SEO meta for marketplace homepage */}
      <SEO
        title="Atlastays Marketplace — Verified homes & rooms across India"
        description="Discover homes and rooms across verified hosts on Atlastays. Direct booking, no platform fee."
      />
      <h1 className="text-3xl font-bold text-text-primary">Atlastays Marketplace</h1>
      <p className="mt-2 text-text-body">Discover homes and rooms across verified hosts.</p>

      {/* TASK-4511: trust strip — real computed numbers only, no fabricated stats/urgency. */}
      {!loading && items.length > 0 && (
        <div
          data-testid="marketplace-trust-strip"
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted"
        >
          <span>{verifiedHomesCount} Verified homes</span>
          <span aria-hidden>·</span>
          <span>{items.length} listings</span>
          <span aria-hidden>·</span>
          <span className="font-medium text-emerald-700">0% Platform commission</span>
          <span aria-hidden>·</span>
          <span>GST-inclusive pricing shown upfront · book direct</span>
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
        {(['all', 'homes', 'rooms'] as const).map((c) => (
          <button
            key={c}
            data-testid={`marketplace-filter-${c}`}
            className={`min-h-[44px] rounded-xl px-4 py-2 ${category === c ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}
            onClick={() => setCategory(c)}
          >
            {c[0].toUpperCase() + c.slice(1)}
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

      {/* TASK-4413: price-range control — client-side filter over the fetched grid. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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

            return (
              <article
                key={item.id}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-sm transition-colors hover:border-border-subtle"
                data-testid="marketplace-card"
              >
                {/* TASK-1874: OptimizedImage replaces raw <img> */}
                <div className="h-40 w-full bg-bg-muted">
                  <OptimizedImage
                    src={sanitizeGuestImageUrl(item.coverImageUrl) ?? ''}
                    alt={item.title || 'Listing photo'}
                    className="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>

                {/* TASK-1873: save heart */}
                <button
                  type="button"
                  aria-label={isFav ? 'Remove from saved' : 'Save listing'}
                  className="absolute right-2 top-2 z-10 rounded-full bg-bg-surface/95 p-2 shadow border border-border-subtle hover:opacity-90 transition-opacity"
                  onClick={() => {
                    toggleFavorite(item.id);
                    setFavEpoch((e) => e + 1);
                  }}
                >
                  {isFav
                    ? <FaHeart className="h-4 w-4 text-red-500" aria-hidden />
                    : <FaRegHeart className="h-4 w-4 text-text-muted" aria-hidden />}
                </button>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="text-xs uppercase tracking-wide text-text-muted">{item.tenantName}</div>
                  <h2 className="text-base font-semibold text-text-primary leading-snug">{item.title}</h2>

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

                  {/* TASK-1873: neighborhood/city chip */}
                  {item.city && (
                    <span className="w-fit rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {item.city}
                    </span>
                  )}

                  <p className="text-sm text-text-body">Sleeps up to {item.maxGuests} guest{item.maxGuests === 1 ? '' : 's'}</p>

                  {/* TASK-1873: rating row */}
                  {item.rating != null && item.rating > 0 && (
                    <p className="text-sm font-medium text-[var(--accent-text)]">
                      {'★'.repeat(Math.round(item.rating))}
                      <span className="ml-1 text-text-muted">{item.rating.toFixed(1)}</span>
                      {item.reviewCount != null && item.reviewCount > 0 && (
                        <span className="ml-1 text-text-muted">({item.reviewCount})</span>
                      )}
                    </p>
                  )}

                  {/* TASK-4511: keyword-bucketed sentiment chip — matches SearchPage.tsx card treatment */}
                  <ReviewSummary listingId={item.id} />

                  {/* TASK-1872: formatCurrency replaces raw 'INR X' */}
                  <p className="text-xl font-bold text-text-primary">
                    {formatCurrency(item.pricePerNight, { maximumFractionDigits: 0 })}
                    <span className="ml-1 text-sm font-normal text-text-muted">/ night</span>
                  </p>

                  {/* TASK-1873/TASK-2903: GST-inclusive estimate — use shared utility for consistency; TASK-4312: respect listing GST status */}
                  <p className="text-xs text-text-muted">
                    {formatEstTotalInclGst(
                      item.pricePerNight,
                      2,
                      (amount) => formatCurrency(amount, { maximumFractionDigits: 0 }),
                      3,
                      item.isGstRegistered,
                      item.pricePerNight,
                    )}
                  </p>

                  {/* TASK-4511: Owner-share trust badge — no nightlyPrice prop (matches SearchPage.tsx's
                      BUG-7 fix; avoids leaking a fabricated host payout figure). */}
                  <OwnerShareBadge className="self-start" />

                  <Link
                    className="mt-auto inline-flex min-h-[40px] items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                    to={marketplaceListingPath(item)}
                  >
                    View home
                  </Link>
                </div>
              </article>
            );
          })}
      </div>

      {/* TASK-4309: explicit empty state so a filter/search with no matches shows a
          message instead of a blank gap between the filter bar and the footer.
          TASK-4413: also covers a price filter that narrows the grid to zero results. */}
      {!loading && visibleItems.length === 0 && (
        <div
          data-testid="marketplace-empty"
          className="mt-8 rounded-2xl border border-dashed border-border bg-bg-surface p-10 text-center"
        >
          <p className="text-base font-semibold text-text-primary">No stays match these filters yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Try the “All” tab or a different city to see available homes and rooms.
          </p>
        </div>
      )}
    </section>
  );
}
