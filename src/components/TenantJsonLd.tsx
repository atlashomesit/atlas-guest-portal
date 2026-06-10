/**
 * RA-006/TASK-2335: Runtime JSON-LD injection for tenant-aware schema.org metadata.
 * TASK-4058: Enhanced with ContactPoint (via contact.ts), hreflang alternates (via i18n).
 *
 * Renders Organization and FAQPage JSON-LD blocks using the tenant context
 * (brand name, logo, contact email). This component appends the JSON-LD scripts
 * to <head> after the tenant context resolves, replacing the static blocks in
 * index.html that hardcode Atlas Homestays brand strings.
 *
 * Per ADR-0018: runtime DOM rewrite (no SSR, no Cloudflare Worker).
 */

import { useEffect } from 'react';
import { getTenantContext } from '@/tenant/tenantContext';
import { getTenantBrandName } from '@/tenant/displayBrand';
import { getContactPhone, getContactEmail } from '@/config/contact';
import { getAvailableLanguages } from '@/i18n/i18n';

/**
 * Appends a JSON-LD script tag to <head>.
 * If a script with the same `data-json-ld` attribute already exists, replaces it.
 */
function appendJsonLdScript(
  id: string,
  jsonLd: Record<string, unknown> | Record<string, unknown>[],
): void {
  const selector = `script[data-json-ld-id="${id}"]`;
  const existing = document.head.querySelector(selector);

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-json-ld-id', id);
  script.textContent = JSON.stringify(jsonLd);

  if (existing) {
    existing.replaceWith(script);
  } else {
    document.head.appendChild(script);
  }
}

export const TenantJsonLd: React.FC = () => {
  useEffect(() => {
    const tenantInfo = getTenantContext();
    if (!tenantInfo) {
      // If tenant context is not resolved yet, skip (should not happen in normal flow)
      return;
    }

    const brandName = getTenantBrandName();
    const businessPhone = getContactPhone('business');
    const canonicalEmail = getContactEmail();

    // ── Organization JSON-LD ─────────────────────────────────────────────────────
    // Logo field is omitted if logoUrl is not set (better than a default Atlas logo).
    // ContactPoint sourced from contact.ts helpers to ensure canonical values.
    const organizationJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: brandName,
      email: canonicalEmail,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Service',
        telephone: `+91${businessPhone}`,
        email: canonicalEmail,
      },
    };
    if (typeof window !== 'undefined') {
      organizationJsonLd.url = `${window.location.origin}/`;
    }

    // Add logo only if logoUrl is set
    if (tenantInfo.logoUrl) {
      organizationJsonLd.logo = tenantInfo.logoUrl;
    }

    // Add address fields from legalContactPack if available
    if (tenantInfo.legalContactPack) {
      const { registeredAddress, city, state, pincode } =
        tenantInfo.legalContactPack;
      if (registeredAddress || city || state || pincode) {
        organizationJsonLd.address = {
          '@type': 'PostalAddress',
          ...(registeredAddress && { streetAddress: registeredAddress }),
          ...(city && { addressLocality: city }),
          ...(state && { addressRegion: state }),
          ...(pincode && { postalCode: pincode }),
          addressCountry: 'IN',
        };
      }
    }

    appendJsonLdScript('organization', organizationJsonLd);

    // ── FAQPage JSON-LD ──────────────────────────────────────────────────────────
    // Replace "Atlas Homestays" in the FAQ question with the tenant's brand name.
    const faqPageJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How do I book a property?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Browse properties on ${
              typeof window !== 'undefined'
                ? window.location.hostname
                : 'your property site'
            }, select your dates, and complete booking via UPI or card. You will receive an instant confirmation.`,
          },
        },
        {
          '@type': 'Question',
          name: `What properties are available at ${brandName}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `${brandName} offers serviced apartments and vacation rentals including studio rooms, 1BHK, and 2BHK units. All properties are verified and managed directly.`,
          },
        },
        {
          '@type': 'Question',
          name: `Is there a booking fee at ${brandName}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `No booking fees. Direct booking means zero commission and zero platform fees. You pay only the nightly rate plus applicable GST.`,
          },
        },
        {
          '@type': 'Question',
          name: 'What payment methods are accepted?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'UPI, credit card, debit card, and net banking via Razorpay. UPI payment is instant with immediate booking confirmation.',
          },
        },
        {
          '@type': 'Question',
          name: `Does ${brandName} provide GST invoices?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. GST-compliant invoices are automatically generated after checkout for all bookings. SAC 9963 with CGST/SGST breakdown for intra-state guests.',
          },
        },
      ],
    };

    appendJsonLdScript('faqpage', faqPageJsonLd);

    // ── hreflang alternate links (TASK-4058) ──────────────────────────────────────
    // Inject hreflang links for all supported locales + x-default.
    // This aids Google's multi-language detection and alternate version crawling.
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (currentUrl) {
      const supportedLangs = getAvailableLanguages(); // ['en', 'hi', 'te']

      // Remove existing hreflang links (we'll recreate them)
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => {
        el.remove();
      });

      // Add hreflang for each language using search params (no locale path segments)
      // Preserve existing query params and append/update lang param
      const url = new URL(currentUrl);
      supportedLangs.forEach((lang) => {
        const langUrl = new URL(url);
        langUrl.searchParams.set('lang', lang);
        const link = document.createElement('link');
        link.rel = 'alternate';
        link.hreflang = lang;
        link.href = langUrl.toString();
        document.head.appendChild(link);
      });

      // Add x-default hreflang pointing to the canonical (en) version without lang param
      const defaultUrl = new URL(url);
      defaultUrl.searchParams.delete('lang');
      const defaultLink = document.createElement('link');
      defaultLink.rel = 'alternate';
      defaultLink.hreflang = 'x-default';
      defaultLink.href = defaultUrl.toString();
      document.head.appendChild(defaultLink);
    }
  }, []);

  return null;
};

export default TenantJsonLd;
