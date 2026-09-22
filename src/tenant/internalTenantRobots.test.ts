import { describe, expect, it, afterEach } from 'vitest';
import { getInternalTenantRobots, _resetTenantContextForTests, _setTenantContextForTests } from './tenantContext';
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

  // TASK-7866 regression (prod-environment-indexing, 2026-09-17): production hosts report
  // ATLAS_ENVIRONMENT="prod", not "production". The old `env !== 'production'` check treated
  // "prod" as non-production and injected noindex on every production tenant page.
  it('returns undefined for the real prod environment value', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: 'prod' });
    expect(getInternalTenantRobots()).toBeUndefined();
  });

  it('treats "prod" case-insensitively and trims whitespace', () => {
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: '  PROD  ' });
    expect(getInternalTenantRobots()).toBeUndefined();
  });

  // Existing suppression (isInternal) must survive the fix unchanged: an internal tenant still
  // noindexes in production, same as it always has — this check runs before the environment
  // check and was never broken, but TASK-7866's own fix must not regress it either.
  it('still noindexes an internal tenant even when environment is the real prod value', () => {
    _setTenantContextForTests({ name: 'Showcase', slug: 'atlas-showcase', isInternal: true });
    setRuntimeConfig({ apiBaseUrl: 'http://localhost', environment: 'prod' });
    expect(getInternalTenantRobots()).toBe('noindex, nofollow');
  });
});
