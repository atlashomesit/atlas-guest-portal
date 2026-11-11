import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _setTenantContextForTests } from '../tenant/tenantContext';
import { setDomainResolvedSlug } from '../tenant/tenantResolver';
import { settle } from '../test/settle';
import { useTenantProcessingFee } from './useTenantProcessingFee';

let sequence = 0;
function tenant(slug: string, bookingMode: 'ONLINE' | 'WHATSAPP' = 'ONLINE') {
  setDomainResolvedSlug(slug);
  _setTenantContextForTests({ slug, name: slug, bookingMode });
}

describe('tenant-scoped fee metadata', () => {
  beforeEach(() => { tenant(`fee-fixture-${++sequence}`); });

  it('deduplicates mounted consumers and preserves fractional and zero percentages', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ convenienceFeePercent: 1.25 }) });
    vi.stubGlobal('fetch', fetcher);
    const first = renderHook(() => useTenantProcessingFee());
    const second = renderHook(() => useTenantProcessingFee());
    expect(first.result.current).toBeNull();
    await settle();
    expect(first.result.current).toBe(1.25);
    expect(second.result.current).toBe(1.25);
    expect(fetcher).toHaveBeenCalledTimes(1);
    tenant(`fee-zero-${sequence}`);
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ convenienceFeePercent: 0 }) });
    first.rerender();
    expect(first.result.current).toBeNull();
    await settle();
    expect(first.result.current).toBe(0);
  });

  it('clears the old tenant value immediately and ignores a late previous-tenant result', async () => {
    let resolveOld!: (response: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => ({ convenienceFeePercent: 2.5 }) });
    vi.stubGlobal('fetch', fetcher);
    const hook = renderHook(() => useTenantProcessingFee());
    tenant(`fee-next-${sequence}`);
    hook.rerender();
    await settle();
    expect(hook.result.current).toBe(2.5);
    await act(async () => { resolveOld({ ok: true, json: async () => ({ convenienceFeePercent: 9 }) }); });
    expect(hook.result.current).toBe(2.5);
    expect(fetcher.mock.calls[1][1].headers['X-Tenant-Slug']).toBe(`fee-next-${sequence}`);
  });

  it.each([{}, { convenienceFeePercent: null }, { convenienceFeePercent: -1 }, { convenienceFeePercent: '1' }])('keeps absent or invalid settings unknown: %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const hook = renderHook(() => useTenantProcessingFee());
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current).toBeNull();
  });

  it('does not fetch an online fee for manual/WhatsApp rails or disabled marketplace consumers', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    tenant(`fee-offline-${sequence}`, 'WHATSAPP');
    expect(renderHook(() => useTenantProcessingFee()).result.current).toBe(0);
    tenant(`fee-disabled-${sequence}`);
    expect(renderHook(() => useTenantProcessingFee(false)).result.current).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
