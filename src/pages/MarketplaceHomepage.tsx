import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildApiUrl } from '@/api/client';

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
};

type ApiResponse = { items: MarketplaceItem[]; total: number; page: number; pageSize: number };

export default function MarketplaceHomepage() {
  const [category, setCategory] = useState<'all' | 'homes' | 'rooms'>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8" data-testid="marketplace-homepage">
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
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="marketplace-grid">
        {loading && <div>Loading listings...</div>}
        {!loading &&
          items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-border p-4" data-testid="marketplace-card">
              {item.coverImageUrl ? <img src={item.coverImageUrl} alt="" className="mb-3 h-40 w-full rounded-xl object-cover" /> : null}
              <div className="text-xs uppercase tracking-wide text-text-muted">{item.tenantName}</div>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">{item.title}</h2>
              <p className="mt-1 text-sm text-text-body">{item.city || 'Unknown city'}</p>
              <p className="mt-1 text-sm text-text-body">Max guests: {item.maxGuests}</p>
              <p className="mt-1 font-semibold text-text-primary">INR {item.pricePerNight}/night</p>
              <Link className="mt-3 inline-block rounded-lg bg-black px-3 py-2 text-sm text-white" to={`/${item.slug}`}>
                View details
              </Link>
            </article>
          ))}
      </div>
    </section>
  );
}

