import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/runtime-config';

type EmbedConfig = {
  tenantId: number;
  tenantSlug: string;
  tenantName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  tagline?: string | null;
  isLiveEligible: boolean;
  websiteState: string;
  blocker?: string | null;
  publishedListingsCount: number;
};

export default function EmbedPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!embedKey) {
      setError('Missing embed key');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const base = getApiBaseUrl().replace(/\/$/, '');
    fetch(`${base}/api/public/embed/${encodeURIComponent(embedKey)}/config`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          throw new Error(body || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: EmbedConfig) => {
        if (cancelled) return;
        // API returns PascalCase? Normalize
        const normalized: EmbedConfig = {
          tenantId: (data as unknown as Record<string, unknown>).tenantId as number ?? (data as unknown as Record<string, unknown>).TenantId as number,
          tenantSlug: (data as unknown as Record<string, unknown>).tenantSlug as string ?? (data as unknown as Record<string, unknown>).TenantSlug as string,
          tenantName: (data as unknown as Record<string, unknown>).tenantName as string ?? (data as unknown as Record<string, unknown>).TenantName as string,
          logoUrl: (data as unknown as Record<string, unknown>).logoUrl as string ?? (data as unknown as Record<string, unknown>).LogoUrl as string ?? null,
          brandColor: (data as unknown as Record<string, unknown>).brandColor as string ?? (data as unknown as Record<string, unknown>).BrandColor as string ?? null,
          tagline: (data as unknown as Record<string, unknown>).tagline as string ?? (data as unknown as Record<string, unknown>).Tagline as string ?? null,
          isLiveEligible: (data as unknown as Record<string, unknown>).isLiveEligible as boolean ?? (data as unknown as Record<string, unknown>).IsLiveEligible as boolean ?? false,
          websiteState: (data as unknown as Record<string, unknown>).websiteState as string ?? (data as unknown as Record<string, unknown>).WebsiteState as string ?? 'Unknown',
          blocker: (data as unknown as Record<string, unknown>).blocker as string ?? (data as unknown as Record<string, unknown>).Blocker as string ?? null,
          publishedListingsCount: (data as unknown as Record<string, unknown>).publishedListingsCount as number ?? (data as unknown as Record<string, unknown>).PublishedListingsCount as number ?? 0,
        };
        // Fallback if normalized failed: use raw data as-is with lowercamel
        if (!normalized.tenantSlug) {
          const raw = data as unknown as Record<string, unknown>;
          normalized.tenantSlug = (raw.tenantSlug ?? raw.TenantSlug ?? '') as string;
          normalized.tenantName = (raw.tenantName ?? raw.TenantName ?? '') as string;
          normalized.isLiveEligible = (raw.isLiveEligible ?? raw.IsLiveEligible ?? false) as boolean;
          normalized.websiteState = (raw.websiteState ?? raw.WebsiteState ?? '') as string;
          normalized.publishedListingsCount = (raw.publishedListingsCount ?? raw.PublishedListingsCount ?? 0) as number;
        }
        setConfig(normalized);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [embedKey]);

  // Height postMessage to parent for auto-resize
  useEffect(() => {
    if (!embedKey || !config) return;
    const send = () => {
      const h = containerRef.current?.scrollHeight ?? document.body.scrollHeight;
      try {
        window.parent.postMessage({ type: 'atlas-embed-resize', embedKey, height: h }, '*');
      } catch {
        /* cross-origin parent may be opaque */
      }
    };
    send();
    const ro = new ResizeObserver(send);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', send);
    const id = window.setInterval(send, 1000);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', send);
      window.clearInterval(id);
    };
  }, [embedKey, config, loading]);

  if (loading) {
    return (
      <div data-testid="embed-loading" style={{ padding: 24, fontFamily: 'system-ui' }}>
        Loading booking widget…
      </div>
    );
  }

  if (error || !config) {
    return (
      <div data-testid="embed-error" style={{ padding: 24, fontFamily: 'system-ui', color: '#b42318' }}>
        Booking widget unavailable. {error ? `(${error.slice(0, 200)})` : ''}
      </div>
    );
  }

  if (!config.isLiveEligible) {
    return (
      <div
        data-testid="embed-not-eligible"
        style={{ padding: 24, fontFamily: 'system-ui', border: '1px solid #e5e7eb', borderRadius: 12 }}
      >
        <h3 style={{ margin: 0, fontWeight: 600 }}>Booking not available</h3>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
          This property is not currently taking bookings. Please contact the host directly.
        </p>
        <p data-testid="embed-blocker" style={{ display: 'none' }}>
          {config.blocker ?? config.websiteState}
        </p>
      </div>
    );
  }

  const brand = config.brandColor || '#0f766e';
  // Link to full site reserve page with tenant hint so X-Tenant-Slug resolves via ?tenant=
  const reserveHref = `/reserve?tenant=${encodeURIComponent(config.tenantSlug)}`;

  return (
    <div
      ref={containerRef}
      data-testid="embed-widget"
      data-embed-key={embedKey}
      data-tenant-slug={config.tenantSlug}
      style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 480, margin: '0 auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt={`${config.tenantName} logo`}
            style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8 }}
          />
        ) : null}
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{config.tenantName}</div>
          {config.tagline ? <div style={{ color: '#6b7280', fontSize: 13 }}>{config.tagline}</div> : null}
        </div>
      </div>

      <div
        data-testid="embed-availability"
        style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}
      >
        <h4 style={{ margin: '0 0 8px', fontWeight: 600 }}>Check availability</h4>
        <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 14 }}>
          {config.publishedListingsCount > 0
            ? `${config.publishedListingsCount} stay${config.publishedListingsCount === 1 ? '' : 's'} available`
            : 'No stays currently listed'}
        </p>
        <a
          href={reserveHref}
          data-testid="embed-book-now"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: brand,
            color: 'white',
            padding: '10px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Book now
        </a>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
          Powered by Atlas
        </div>
      </div>
    </div>
  );
}
