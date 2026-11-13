import { beforeEach, describe, expect, it } from 'vitest';
import { setRuntimeConfig } from '@/runtime-config';

const runtime: { environment: string | undefined } = { environment: undefined };
function useEnvironment(environment: string | undefined) {
  runtime.environment = environment;
  setRuntimeConfig({ apiBaseUrl: 'https://api.test', globalDiscountPercent: 0, tenantKey: 'from-runtime', environment } as never);
}

// TASK-1040055 (tenant isolation): a host's own site must never show one tenant's brand/contact beside another tenant's data.
// `?tenant=<slug>` exists for the marketplace (cross-host listings); on a host-mapped origin it must not change whose data is read.


import {
  _resetTenantResolutionForTests,
  setDomainResolvedSlug,
  setMarketplaceMode,
} from '@/tenant/tenantResolver';
import { getApiHeaders } from './client';
import { resolveHonoredUrlTenant, isUrlTenantOverridingHost } from '@/tenant/urlTenantGuard';

describe('?tenant= on a host-mapped origin (TASK-1040055)', () => {
  beforeEach(() => {
    _resetTenantResolutionForTests();
    useEnvironment('production');
    window.history.replaceState({}, '', '/');
  });

  it('PRODUCTION: a host site ignores ?tenant= for another tenant, so data, brand and contact stay one tenant', () => {
    setDomainResolvedSlug('grove-and-co');
    setMarketplaceMode(false);
    window.history.replaceState({}, '', '/homes/x/1?tenant=some-other-host');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'grove-and-co' });
  });

  it('PRODUCTION: an unknown environment is treated as production (fail safe)', () => {
    useEnvironment(undefined);
    setDomainResolvedSlug('grove-and-co');
    setMarketplaceMode(false);
    window.history.replaceState({}, '', '/?tenant=some-other-host');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'grove-and-co' });
  });

  it('the marketplace still honours ?tenant= (that is what it is for)', () => {
    setDomainResolvedSlug('marketplace');
    setMarketplaceMode(true);
    window.history.replaceState({}, '', '/homes/x/1?tenant=millionairesmansion');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'millionairesmansion' });
  });

  it('the same tenant named twice is harmless', () => {
    setDomainResolvedSlug('grove-and-co');
    window.history.replaceState({}, '', '/?tenant=GROVE-AND-CO');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'grove-and-co' });
  });

  it('QA keeps the E2E affordance: a fresh test tenant on the shared QA host is honoured', () => {
    useEnvironment('qa');
    setDomainResolvedSlug('atlas');
    setMarketplaceMode(false);
    window.history.replaceState({}, '', '/?tenant=qa-bot-05b3c1');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'qa-bot-05b3c1' });
  });

  it('a malformed ?tenant= is never sent', () => {
    useEnvironment('qa');
    setDomainResolvedSlug('atlas');
    window.history.replaceState({}, '', '/?tenant=' + encodeURIComponent('a b;drop'));
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'atlas' });
  });

  it('resolveHonoredUrlTenant is the one rule', () => {
    const base = { marketplaceMode: false, environment: 'production' as string | undefined };
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: 'b', domainSlug: 'a' })).toBeNull();
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: 'a', domainSlug: 'a' })).toBe('a');
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: 'b', domainSlug: null })).toBe('b'); // no host tenant to conflict with
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: 'b', domainSlug: 'a', marketplaceMode: true })).toBe('b');
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: 'b', domainSlug: 'a', environment: 'staging' })).toBe('b');
    expect(resolveHonoredUrlTenant({ ...base, urlSlug: null, domainSlug: 'a' })).toBeNull();
  });

  it('isUrlTenantOverridingHost is true only when the honoured URL tenant differs from the host tenant', () => {
    expect(isUrlTenantOverridingHost({ urlSlug: 'b', domainSlug: 'a', marketplaceMode: false, environment: 'qa' })).toBe(true);
    expect(isUrlTenantOverridingHost({ urlSlug: 'b', domainSlug: 'a', marketplaceMode: false, environment: 'production' })).toBe(false);
    expect(isUrlTenantOverridingHost({ urlSlug: 'a', domainSlug: 'a', marketplaceMode: false, environment: 'qa' })).toBe(false);
    expect(isUrlTenantOverridingHost({ urlSlug: 'b', domainSlug: 'a', marketplaceMode: true, environment: 'qa' })).toBe(false);
  });
});
