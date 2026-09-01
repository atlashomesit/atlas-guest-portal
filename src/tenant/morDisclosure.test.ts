/**
 * TASK-4161: Merchant-of-record + grievance-contact disclosure gate.
 *
 * Verifies that the isCustomDomain flag is parsed correctly from the from-domain
 * API payload, and that non-custom-domain tenants do NOT get the flag set.
 * The disclosure itself (Footer JSX, GuestDetailsPage JSX) is covered by Playwright
 * E2E; this unit test guards the data layer.
 */

import { describe, it, expect } from 'vitest';
import { parseLegalContactPack } from './tenantContext';

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
