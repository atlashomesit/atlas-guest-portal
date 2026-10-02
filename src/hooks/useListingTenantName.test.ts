import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { settle } from '../test/settle';
import { useListingTenantName } from './useListingTenantName';
vi.mock('../api/client', () => ({ buildApiUrl: (path: string) => `http://localhost${path}` }));
afterEach(() => vi.unstubAllGlobals());
describe('marketplace listing identity', () => {
  it('reads the matching public name without changing tenant context or sending credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slug: 'cedar', name: 'Cedar Stays' }) });
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useListingTenantName('cedar'));
    await settle();
    expect(result.current).toBe('Cedar Stays');
    expect(fetcher).toHaveBeenCalledWith('http://localhost/tenants/cedar/public', expect.objectContaining({ credentials: 'omit' }));
  });
  it('does not reuse another listing identity during navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slug: 'cedar', name: 'Cedar Stays' }) }));
    const { result, rerender } = renderHook(({ slug }) => useListingTenantName(slug), { initialProps: { slug: 'cedar' } });
    await settle();
    expect(result.current).toBe('Cedar Stays');
    rerender({ slug: 'willow' });
    expect(result.current).toBeNull();
  });
  it.each([null, '../cedar', ''])('does not fetch an absent or malformed slug %s', slug => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(renderHook(() => useListingTenantName(slug)).result.current).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps unavailable identities unknown', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useListingTenantName('cedar'));
    await settle(); expect(fetcher).toHaveBeenCalledOnce();
    expect(result.current).toBeNull();
  });
});

