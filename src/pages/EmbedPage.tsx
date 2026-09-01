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

export function readableCtaText(background: string): string {
  const match = background.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return 'var(--text-on-cta, #ffffff)';
  const hex = match[1].length === 3 ? match[1].split('').map((channel) => `${channel}${channel}`).join('') : match[1];
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? '#111827' : '#ffffff';
}

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
      <div
        data-testid="embed-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-24 bg-bg-primary p-6 font-sans text-text-primary"
      >
        Loading booking widget…
      </div>
    );
  }

  if (error || !config) {
    return (
      <div
        data-testid="embed-error"
        role="alert"
        className="min-h-24 border border-border-subtle bg-bg-surface p-6 font-sans text-support-error"
      >
        Booking widget unavailable. {error ? `(${error.slice(0, 200)})` : ''}
      </div>
    );
  }

  if (!config.isLiveEligible) {
    return (
      <div
        data-testid="embed-not-eligible"
        className="border border-border-subtle bg-bg-surface p-6 font-sans text-text-primary rounded-xl"
      >
        <h3 className="m-0 font-semibold">Booking not available</h3>
        <p className="mt-2 text-text-secondary">
          This property is not currently taking bookings. Please contact the host directly.
        </p>
        <p data-testid="embed-blocker" style={{ display: 'none' }}>
          {config.blocker ?? config.websiteState}
        </p>
      </div>
    );
  }

  const brand = config.brandColor?.trim() || '#0f766e';
  const brandText = readableCtaText(brand);
  // Link to full site reserve page with tenant hint so X-Tenant-Slug resolves via ?tenant=
  const reserveHref = `/reserve?tenant=${encodeURIComponent(config.tenantSlug)}`;

  return (
    <div
      ref={containerRef}
      data-testid="embed-widget"
      data-embed-key={embedKey}
      data-tenant-slug={config.tenantSlug}
      className="mx-auto max-w-[480px] bg-bg-primary p-4 font-sans text-text-primary"
    >
      <div className="mb-4 flex items-center gap-3">
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt={`${config.tenantName} logo`}
            className="h-12 w-12 rounded-lg object-contain"
          />
        ) : null}
        <div>
          <div className="text-base font-bold">{config.tenantName}</div>
          {config.tagline ? <div className="text-[13px] text-text-secondary">{config.tagline}</div> : null}
        </div>
      </div>

      <div
        data-testid="embed-availability"
        className="rounded-xl border border-border-subtle bg-bg-surface p-4"
      >
        <h4 className="mb-2 font-semibold">Check availability</h4>
        <p className="mb-3 text-sm text-text-secondary">
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
            color: brandText,
            padding: '10px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Book now
        </a>
        <div className="mt-2 text-xs text-text-muted">
          Powered by Atlas
        </div>
      </div>
    </div>
  );
}
