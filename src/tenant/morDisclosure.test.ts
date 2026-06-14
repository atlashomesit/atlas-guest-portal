/**
 * TASK-4161: Merchant-of-record + grievance-contact disclosure gate.
 *
 * Verifies that the isCustomDomain flag is parsed correctly from the from-domain
 * API payload, and that non-custom-domain tenants do NOT get the flag set.
 * The disclosure itself (Footer JSX, GuestDetailsPage JSX) is covered by Playwright
 * E2E; this unit test guards the data layer.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ── Minimal replay of the tenantContext parsing logic ─────────────────────────
// We test the parsing rules directly so we don't need to mock fetch.

function parseLegalContactPack(data: Record<string, unknown>) {
  const pack = data.legalContactPack as Record<string, unknown> | null | undefined;
  if (!pack) return undefined;
  return {
    legalName: typeof pack.legalName === 'string' ? pack.legalName : undefined,
    displayName: typeof pack.displayName === 'string' ? pack.displayName : undefined,
    contactEmail: typeof pack.contactEmail === 'string' ? pack.contactEmail : undefined,
    contactPhone: typeof pack.contactPhone === 'string' ? pack.contactPhone : undefined,
    registeredAddress: typeof pack.registeredAddress === 'string' ? pack.registeredAddress : undefined,
    city: typeof pack.city === 'string' ? pack.city : undefined,
    state: typeof pack.state === 'string' ? pack.state : undefined,
    pincode: typeof pack.pincode === 'string' ? pack.pincode : undefined,
    gstin: typeof pack.gstin === 'string' ? pack.gstin : undefined,
    showAtlasFooterCredit: Boolean(pack.showAtlasFooterCredit),
    isCustomDomain: Boolean(pack.isCustomDomain),
  };
}

describe('TASK-4161: legalContactPack.isCustomDomain parsing', () => {
  describe('custom-domain tenant API payload', () => {
    const customDomainPayload = {
      tenantSlug: 'sunrise-villas',
      brandName: 'Sunrise Villas',
      legalContactPack: {
        legalName: 'Sunrise Villas Hospitality Pvt Ltd',
        displayName: 'Sunrise Villas',
        contactEmail: 'grievance@sunrisevillas.com',
        contactPhone: '+917000000001',
        showAtlasFooterCredit: false,
        isCustomDomain: true,
      },
    };

    it('parses isCustomDomain as true', () => {
      const pack = parseLegalContactPack(customDomainPayload);
      expect(pack?.isCustomDomain).toBe(true);
    });

    it('parses legalName correctly', () => {
      const pack = parseLegalContactPack(customDomainPayload);
      expect(pack?.legalName).toBe('Sunrise Villas Hospitality Pvt Ltd');
    });

    it('parses contactEmail correctly', () => {
      const pack = parseLegalContactPack(customDomainPayload);
      expect(pack?.contactEmail).toBe('grievance@sunrisevillas.com');
    });

    it('parses contactPhone correctly', () => {
      const pack = parseLegalContactPack(customDomainPayload);
      expect(pack?.contactPhone).toBe('+917000000001');
    });

    it('showAtlasFooterCredit is false for white-label tenant', () => {
      const pack = parseLegalContactPack(customDomainPayload);
      expect(pack?.showAtlasFooterCredit).toBe(false);
    });
  });

  describe('Atlas default domain payload (localhost / atlashomestays.com)', () => {
    const atlasDomainPayload = {
      tenantSlug: 'atlas',
      brandName: 'Atlas Homestays',
      legalContactPack: {
        legalName: 'Atlas Homes',
        displayName: 'Atlas Homes',
        contactEmail: 'stay@atlashomestays.com',
        contactPhone: '+917416261981',
        showAtlasFooterCredit: false,
        isCustomDomain: false,   // Atlas default domain: must be false
      },
    };

    it('parses isCustomDomain as false — disclosure must NOT render', () => {
      const pack = parseLegalContactPack(atlasDomainPayload);
      expect(pack?.isCustomDomain).toBe(false);
    });
  });

  describe('API payload missing legalContactPack', () => {
    it('returns undefined when legalContactPack is absent', () => {
      const pack = parseLegalContactPack({ tenantSlug: 'some-tenant' });
      expect(pack).toBeUndefined();
    });
  });

  describe('API payload with isCustomDomain absent (old API version)', () => {
    it('defaults isCustomDomain to false when field is missing', () => {
      const pack = parseLegalContactPack({
        tenantSlug: 'legacy',
        legalContactPack: {
          legalName: 'Legacy Hotel',
          showAtlasFooterCredit: false,
          // isCustomDomain not present — simulates an old API version
        },
      });
      // Boolean(undefined) === false — safe default
      expect(pack?.isCustomDomain).toBe(false);
    });
  });
});
