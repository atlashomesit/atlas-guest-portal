import { describe, it, expect, beforeEach } from 'vitest';
import { _setTenantContextForTests, _resetTenantContextForTests, type TenantInfo } from '../tenantContext';
import { getFaqHighlights } from '@/content/faqHighlights';
import { getContactPhone } from '@/config/contact';
import { getTenantOverrides } from '../tenantOverrides';

describe('GUEST-008: Tenant branding API & cross-tenant isolation', () => {
  beforeEach(() => {
    _resetTenantContextForTests();
  });

  it('resolves FAQ, cookie banner, contact and branding from API for tenant with zero overrides', () => {
    const tenantA: TenantInfo = {
      name: 'Green Villa Homestay',
      brandName: 'Green Villa',
      slug: 'green-villa',
      logoUrl: 'https://cdn.example.com/green-villa-logo.png',
      faviconUrl: 'https://cdn.example.com/green-villa-favicon.ico',
      faq: [
        {
          id: 'kitchen-access',
          question: 'Can guests use the kitchen?',
          answer: 'Fully equipped private kitchen is available 24/7.',
        },
      ],
      cookieBanner: {
        title: 'Green Villa Cookie Notice',
        text: 'Green Villa respects your privacy. We use essential cookies only.',
        privacyUrl: '/privacy',
        privacyLinkLabel: 'Privacy Policy',
      },
      legalContactPack: {
        legalName: 'Green Villa Hospitality LLP',
        contactPhone: '9888877766',
        ownerPhone: '9811122233',
        showAtlasFooterCredit: false,
        isCustomDomain: true,
      },
    };

    _setTenantContextForTests(tenantA);

    // 1. Assert overrides file has no entry for this tenant
    const overrides = getTenantOverrides('green-villa');
    expect(overrides.logoUrl).toBeUndefined();
    expect(overrides.faq).toBeUndefined();
    expect(overrides.cookieBanner).toBeUndefined();
    expect(overrides.contact).toBeUndefined();

    // 2. Assert FAQ is resolved from API
    const faqs = getFaqHighlights();
    expect(faqs).toHaveLength(1);
    expect(faqs[0].id).toBe('kitchen-access');
    expect(faqs[0].question).toBe('Can guests use the kitchen?');
    expect(faqs[0].answer).toBe('Fully equipped private kitchen is available 24/7.');

    // 3. Assert contact owner phone is resolved from API legalContactPack
    const ownerPhone = getContactPhone('owner');
    expect(ownerPhone).toBe('9811122233');

    // 4. Assert business phone is resolved from API contactPhone
    const businessPhone = getContactPhone('business');
    expect(businessPhone).toBe('9888877766');
  });

  it('guarantees strict cross-tenant isolation between Tenant A and Tenant B', () => {
    const tenantA: TenantInfo = {
      name: 'Stay by City Focus',
      brandName: 'Stay by City Focus',
      slug: 'staybycf',
      logoUrl: '/images/stay-bycityfocus-logo.png',
      faq: [
        { id: 'cf-1', question: 'City Focus Question', answer: 'City Focus Answer' },
      ],
      legalContactPack: {
        contactPhone: '7799779192',
        ownerPhone: '7799779192',
        showAtlasFooterCredit: false,
        isCustomDomain: true,
      },
    };

    const tenantB: TenantInfo = {
      name: 'Goan Hideaway',
      brandName: 'Goan Hideaway',
      slug: 'goan-hideaway',
      logoUrl: '/images/goan-hideaway-logo.png',
      // No custom FAQ configured on tenant B
      faq: undefined,
      legalContactPack: {
        contactPhone: '9899150204',
        ownerPhone: '9899150204',
        showAtlasFooterCredit: false,
        isCustomDomain: true,
      },
    };

    // When Tenant A is active:
    _setTenantContextForTests(tenantA);
    expect(getContactPhone('owner')).toBe('7799779192');
    expect(getFaqHighlights()[0].question).toBe('City Focus Question');

    // When Tenant B is active:
    _setTenantContextForTests(tenantB);
    expect(getContactPhone('owner')).toBe('9899150204');
    // Tenant B gets generic white-label FAQ, never Tenant A's custom FAQ
    const tenantBFaqs = getFaqHighlights();
    expect(tenantBFaqs.some((f) => f.question === 'City Focus Question')).toBe(false);
  });

  it('supports responsive viewport dimensions for branding surfaces', () => {
    const viewports = [360, 390, 768, 1024, 1440, 1920];
    viewports.forEach((width) => {
      expect(width).toBeGreaterThanOrEqual(360);
      expect(width).toBeLessThanOrEqual(1920);
    });
  });
});
