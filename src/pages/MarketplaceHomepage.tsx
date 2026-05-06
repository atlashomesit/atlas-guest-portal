import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { buildApiUrl } from '@/api/client';
import { formatCurrency } from '@/utils/formatting'; // TASK-1872
import { getFavoriteIds, toggleFavorite } from '@/utils/guestHistory'; // TASK-1873
import OptimizedImage from '@/components/ui/OptimizedImage'; // TASK-1874
import SkeletonCard from '@/components/apartments/SkeletonCard'; // TASK-1875
import SEO from '@/components/SEO'; // TASK-1876
import MultiPinMap, { type MapPin } from '@/components/map/MultiPinMap'; // TL-PROP

// TL-PROP: shape from GET /marketplace/properties (powers the map view).
type MarketplacePropertyApi = {
  propertyId: number;
  listingId: number;
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
};

type ApiResponse = { items: MarketplaceItem[]; total: number; page: number; pageSize: number };

export default function MarketplaceHomepage() {
  const [category, setCategory] = useState<'all' | 'homes' | 'rooms'>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  // TASK-1873: save-heart state keyed by listing id
  const [favEpoch, setFavEpoch] = useState(0);
  const favIds = useMemo(() => new Set(getFavoriteIds()), [favEpoch]);
  // TL-PROP: map view of all marketplace properties. Toggle to show/hide.
  const [showMap, setShowMap] = useState(false);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);

  const apiPath = useMemo(() => {
    const p = new URLSearchParams();
    if (category !== 'all') p.set('category', category);
    if (query.trim()) p.set('city', query.trim());
    p.set('page', '1');
    p.set('pageSize', '20');
    return `/marketplace/listings?${p.toString()}`;
  }, [category, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(buildApiUrl(apiPath))
      .then(async (r) => (r.ok ? ((await r.json()) as ApiResponse) : { items: [] as MarketplaceItem[] }))
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
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
            href: `/${row.listingId}`,
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
        title="Atlas Stays Marketplace — Verified homes & rooms across India"
        description="Discover homes and rooms across verified hosts on Atlas Stays. Direct booking, no platform fee."
      />
      <h1 className="text-3xl font-bold text-text-primary">Atlas Stays Marketplace</h1>
      <p className="mt-2 text-text-body">Discover homes and rooms across verified hosts.</p>

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

      {showMap && mapPins.length > 0 && (
        <div className="mt-6">
          <MultiPinMap pins={mapPins} height={400} />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="marketplace-grid">
        {/* TASK-1875: skeleton cards while loading */}
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading &&
          items.map((item) => {
            // TASK-1869/1873: GST — 5% for ≤₹7,500/night, 18% above (Sept 2025 reform)
            const gstRate = item.pricePerNight > 7500 ? 1.18 : 1.05;
            const gstPct = item.pricePerNight > 7500 ? 18 : 5;
            const estTotal = Math.round(item.pricePerNight * 2 * gstRate);
            const isFav = favIds.has(item.id);

            return (
              <article
                key={item.id}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-sm transition-colors hover:border-border-subtle"
                data-testid="marketplace-card"
              >
                {/* TASK-1874: OptimizedImage replaces raw <img> */}
                <div className="h-40 w-full bg-gradient-to-br from-bg-muted to-bg-surface">
                  <OptimizedImage
                    src={item.coverImageUrl ?? ''}
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

                  {/* TASK-1873: neighborhood/city chip */}
                  {item.city && (
                    <span className="w-fit rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {item.city}
                    </span>
                  )}

                  <p className="text-sm text-text-body">Sleeps up to {item.maxGuests} guests</p>

                  {/* TASK-1873: rating row */}
                  {item.rating != null && item.rating > 0 && (
                    <p className="text-sm font-medium text-accent-primary">
                      {'★'.repeat(Math.round(item.rating))}
                      <span className="ml-1 text-text-muted">{item.rating.toFixed(1)}</span>
                      {item.reviewCount != null && item.reviewCount > 0 && (
                        <span className="ml-1 text-text-muted">({item.reviewCount})</span>
                      )}
                    </p>
                  )}

                  {/* TASK-1872: formatCurrency replaces raw 'INR X' */}
                  <p className="text-xl font-bold text-text-primary">
                    {formatCurrency(item.pricePerNight, { maximumFractionDigits: 0 })}
                    <span className="ml-1 text-sm font-normal text-text-muted">/ night</span>
                  </p>

                  {/* TASK-1873: GST-inclusive estimate */}
                  <p className="text-xs text-text-muted">
                    Est. total: {formatCurrency(estTotal, { maximumFractionDigits: 0 })} (incl. {gstPct}% GST, 2 nights)
                  </p>

                  <Link
                    className="mt-auto inline-flex min-h-[40px] items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                    to={`/${item.slug}`}
                  >
                    View home
                  </Link>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
