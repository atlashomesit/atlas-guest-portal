import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/runtime-config', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  hasRuntimeConfig: () => true,
  getRuntimeConfig: () => ({ tenantKey: 'from-runtime' }),
}));

import {
  _resetTenantResolutionForTests,
  setDomainResolvedSlug,
  setMarketplaceMode,
} from '@/tenant/tenantResolver';
import { getApiHeaders } from './client';

describe('getApiHeaders (TASK-7440)', () => {
  beforeEach(() => {
    _resetTenantResolutionForTests();
    window.history.replaceState({}, '', '/');
  });

  it('sends the resolved white-label slug', () => {
    setDomainResolvedSlug('staybycf');
    setMarketplaceMode(false);
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'staybycf' });
  });

  it('marketplace apex sends platform atlas — never omits tenant or sends marketplace sentinel', () => {
    setDomainResolvedSlug('marketplace');
    setMarketplaceMode(true);
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'atlas' });
  });

  it('maps marketplace sentinel from ?tenant= to atlas', () => {
    window.history.replaceState({}, '', '/homes/x/1?tenant=marketplace');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'atlas' });
  });

  it('honours a real ?tenant= override', () => {
    window.history.replaceState({}, '', '/homes/x/1?tenant=millionairesmansion');
    expect(getApiHeaders()).toEqual({ 'X-Tenant-Slug': 'millionairesmansion' });
  });
});
