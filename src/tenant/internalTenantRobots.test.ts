import { describe, expect, it, afterEach } from 'vitest';
import { getInternalTenantRobots, _resetTenantContextForTests } from './tenantContext';
import { setRuntimeConfig, clearRuntimeConfig } from '@/runtime-config';

describe('getInternalTenantRobots (TASK-4386)', () => {
  afterEach(() => {
    _resetTenantContextForTests();
    clearRuntimeConfig();
  });

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

  // TASK-7866: non-production environments must also noindex.
  it('returns noindex for non-production environment (qa)', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: 'qa' });
    expect(getInternalTenantRobots()).toBe('noindex, nofollow');
  });

  it('returns noindex for non-production environment (dev)', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: 'dev' });
    expect(getInternalTenantRobots()).toBe('noindex, nofollow');
  });

  it('returns undefined for production environment', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: 'production' });
    expect(getInternalTenantRobots()).toBeUndefined();
  });

  it('returns undefined when no environment is set (default = production)', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost' });
    expect(getInternalTenantRobots()).toBeUndefined();
  });
});
