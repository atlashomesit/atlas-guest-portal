import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/api/client';
import HostIdentityLabel from './HostIdentityLabel';
import { TopHostBadge, type TopHostStatsDto } from '@/components/marketplace/TopHostBadge';

/** Read only the public marketplace DTO; tenant listing payloads never establish this claim. */
export default function MarketplaceHostIdentity({ listingId, marketplace }: { listingId: number | string | null | undefined; marketplace: boolean }) {
  const id = typeof listingId === 'string' && /^\d+$/.test(listingId) ? Number(listingId) : listingId;
  if (!marketplace || typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null;
  return <IdentityRead key={id} listingId={id} />;
}

function IdentityRead({ listingId }: { listingId: number }) {
  const [result, setResult] = useState<{
    id: number;
    verified: boolean;
    topHost: boolean;
    topHostStats: TopHostStatsDto | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(buildApiUrl(`/marketplace/properties/${listingId}`), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Identity read unavailable');
        return response.json() as Promise<{
          listingId?: unknown;
          hostIdentityVerified?: unknown;
          topHost?: unknown;
          topHostStats?: TopHostStatsDto | null;
        }>;
      })
      .then(data => {
        if (!controller.signal.aborted) {
          setResult({
            id: listingId,
            verified: data.listingId === listingId && data.hostIdentityVerified === true,
            topHost: data.listingId === listingId && data.topHost === true,
            topHostStats: data.topHostStats ?? null,
          });
        }
      })
      .catch(() => { if (!controller.signal.aborted) setResult(null); });
    return () => controller.abort();
  }, [listingId]);
  const isSame = result?.id === listingId;
  return (
    <div className="flex flex-col gap-2">
      {isSame && result?.topHost && <TopHostBadge stats={result.topHostStats} />}
      <HostIdentityLabel marketplace verified={isSame && result?.verified === true} explain />
    </div>
  );
}
