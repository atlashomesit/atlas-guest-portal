import { describe, expect, it } from 'vitest';
import { getInternalTenantRobots } from './tenantContext';

describe('getInternalTenantRobots (TASK-4386)', () => {
  it('returns noindex for internal tenants', async () => {
    const { resolveFromDomain } = await import('./tenantContext');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          tenantSlug: 'atlas-showcase',
          brandName: 'Showcase',
          isInternal: true,
        }),
      }) as Response;

    await resolveFromDomain('http://localhost', 'showcase.example.com');
    expect(getInternalTenantRobots()).toBe('noindex, nofollow');
    globalThis.fetch = originalFetch;
  });
});
