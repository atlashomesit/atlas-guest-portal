import { useEffect, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';
import { getTenantContext } from '../tenant/tenantContext';
import { hasOnlinePaymentRail } from '../tenant/paymentRail';
import { feePercent } from '../utils/paymentFeeCopy';

type Entry = { expiresAt: number; result: Promise<number | null> };
const cache = new Map<string, Entry>();
const TTL_MS = 60_000;

/** Shared across page copy/cards, scoped to the API origin and the actual request tenant. */
function readFee(url: string, tenant: string): Promise<number | null> {
  const key = `${url}\n${tenant}`;
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.result;
  const result = fetch(url, { headers: getApiHeaders(tenant) })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json() as Record<string, unknown>;
      return feePercent(data.convenienceFeePercent ?? data.ConvenienceFeePercent);
    })
    .catch(() => null);
  cache.set(key, { expiresAt: Date.now() + TTL_MS, result });
  return result;
}

export function useTenantProcessingFee(enabled = true): number | null {
  const tenant = getApiHeaders()['X-Tenant-Slug'] ?? '';
  const context = getTenantContext();
  const online = hasOnlinePaymentRail(context);
  const offline = context?.bookingMode === 'MANUAL' || context?.bookingMode === 'WHATSAPP' || context?.paymentProvider === 'MANUAL';
  const url = buildApiUrl('/tenant/settings/pricing');
  const key = `${url}\n${tenant}\n${online}`;
  const [resolved, setResolved] = useState<{ key: string; percent: number | null } | null>(null);

  useEffect(() => {
    if (!enabled || !online || !tenant) return;
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void readFee(url, tenant).then((percent) => {
        if (!cancelled) setResolved({ key, percent });
      });
    };
    refresh();
    const timer = window.setInterval(refresh, TTL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, online, tenant, url, key]);

  if (!enabled) return null;
  if (offline) return 0;
  return resolved?.key === key ? resolved.percent : null;
}
