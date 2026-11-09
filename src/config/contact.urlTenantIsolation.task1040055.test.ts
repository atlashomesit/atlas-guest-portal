import { beforeEach, describe, expect, it } from 'vitest';
import { setRuntimeConfig } from '@/runtime-config';

const runtime: { environment: string | undefined } = { environment: undefined };
function useEnvironment(environment: string | undefined) {
  runtime.environment = environment;
  setRuntimeConfig({ apiBaseUrl: 'https://api.test', globalDiscountPercent: 0, tenantKey: 'from-runtime', environment } as never);
}

// TASK-1040055: when the data tenant (?tenant=) is not the host's tenant, the host tenant's phone and e-mail must not be shown as that data tenant's contact,
// and the Atlas platform default must not stand in for it either.


import { _resetTenantResolutionForTests, setDomainResolvedSlug, setMarketplaceMode } from '@/tenant/tenantResolver';
import { getContactEmail, getContactPhone, isWhiteLabelTenant } from './contact';

describe('contact when ?tenant= overrides the host tenant (TASK-1040055)', () => {
  beforeEach(() => {
    _resetTenantResolutionForTests();
    useEnvironment('qa');
    window.history.replaceState({}, '', '/');
  });

  it('a QA data tenant on the shared host sees NO platform default phone or e-mail as its contact', () => {
    setDomainResolvedSlug('atlas');
    setMarketplaceMode(false);
    window.history.replaceState({}, '', '/?tenant=qa-bot-05b3c1');
    expect(isWhiteLabelTenant()).toBe(true);
    expect(getContactPhone('business')).toBe('');
    expect(getContactEmail()).toBe('');
  });

  it('without an override the host keeps its own contact behaviour', () => {
    setDomainResolvedSlug('atlas');
    setMarketplaceMode(false);
    expect(isWhiteLabelTenant()).toBe(false);
  });
});
