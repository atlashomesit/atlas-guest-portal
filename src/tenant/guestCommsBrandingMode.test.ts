/**
 * TASK-4899: `resolveFromDomain` must parse `guestCommsBrandingMode` defensively —
 * a recognized value ("Platform" | "Neutral") passes through, anything else
 * (including the field being entirely absent, which is today's real API shape —
 * see this task's PR for the `TenantsController.GetFromDomain` finding) resolves
 * to `undefined` so callers never assume Neutral without confirmation.
 */
import { describe, expect, it } from 'vitest';
import { getTenantContext, resolveFromDomain, _resetTenantContextForTests } from './tenantContext';

async function resolveWithPayload(payload: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => payload,
    }) as Response;
  try {
    await resolveFromDomain('http://localhost', 'example.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('resolveFromDomain — guestCommsBrandingMode parsing (TASK-4899)', () => {
  it('parses "Neutral" through unchanged', async () => {
    _resetTenantContextForTests();
    await resolveWithPayload({ tenantSlug: 'gaurav', brandName: 'Elsiya Loft', guestCommsBrandingMode: 'Neutral' });
    expect(getTenantContext()?.guestCommsBrandingMode).toBe('Neutral');
  });

  it('parses "Platform" through unchanged', async () => {
    _resetTenantContextForTests();
    await resolveWithPayload({ tenantSlug: 'atlas', brandName: 'Atlastays', guestCommsBrandingMode: 'Platform' });
    expect(getTenantContext()?.guestCommsBrandingMode).toBe('Platform');
  });

  it('resolves to undefined when the field is absent (today\'s real API shape)', async () => {
    _resetTenantContextForTests();
    await resolveWithPayload({ tenantSlug: 'some-tenant', brandName: 'Some Tenant' });
    expect(getTenantContext()?.guestCommsBrandingMode).toBeUndefined();
  });

  it('resolves to undefined for an unrecognized value rather than throwing or passing it through', async () => {
    _resetTenantContextForTests();
    await resolveWithPayload({ tenantSlug: 'some-tenant', brandName: 'Some Tenant', guestCommsBrandingMode: 'Bogus' });
    expect(getTenantContext()?.guestCommsBrandingMode).toBeUndefined();
  });
});
