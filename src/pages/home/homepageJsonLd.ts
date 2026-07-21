/**
 * TASK-5200: Pure builder for homepage JSON-LD (unit tests + all theme Home pages).
 * Omits fabricated Offer prices and hardcoded addresses — listing address only when present.
 */
import { CONTACT } from "@/config/contact";

const ATLAS_SOCIAL_SAME_AS = [
  "https://www.facebook.com/profile.php?id=100040632723189",
  // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding
  "https://www.instagram.com/atlashomeskphb/",
  // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding
  "https://x.com/atlashomeskphb",
  // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- Atlas platform social; guarded by hideAtlasBranding
  "https://www.youtube.com/@atlashomestays",
];

export type HomepageJsonLdFaqItem = { question: string; answer: string };

function listingPostalAddress(streetAddress: string): Record<string, unknown> {
  return {
    "@type": "PostalAddress",
    streetAddress,
    addressCountry: "IN",
  };
}

export function buildHomepageJsonLd(input: {
  schemaBrandName: string;
  schemaLogo?: string;
  canonicalUrl: string;
  contactEmail: string;
  hideAtlasBranding: boolean;
  faqHighlights: HomepageJsonLdFaqItem[];
  /** Listing-provided address; omitted from schema when absent. */
  listingAddress?: string | null;
}): Record<string, unknown>[] {
  const listingAddress = input.listingAddress?.trim();

  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.schemaBrandName,
    url: input.canonicalUrl,
    ...(input.schemaLogo ? { logo: input.schemaLogo } : {}),
    description: input.hideAtlasBranding
      ? `Book your stay with ${input.schemaBrandName}.`
      : "Serviced apartments in Hyderabad designed for business travel, family trips, and extended stays.",
    ...(input.hideAtlasBranding ? {} : { sameAs: ATLAS_SOCIAL_SAME_AS }),
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: `+91-${CONTACT.business.phone}`,
        contactType: "customer service",
        areaServed: "IN",
        availableLanguage: ["English"],
      },
    ],
  };

  // TASK-2900 / TASK-5200: Atlas-specific lodging schema must not ship on white-label tenants.
  const lodgingBusiness: Record<string, unknown> | null = input.hideAtlasBranding
    ? null
    : {
        "@context": "https://schema.org",
        "@type": ["LodgingBusiness", "Hotel"],
        name: input.schemaBrandName,
        url: input.canonicalUrl,
        ...(input.schemaLogo ? { logo: input.schemaLogo } : {}),
        description:
          "Serviced apartments in KPHB, Hyderabad with Wi-Fi, parking, and responsive support for business and family stays.",
        slogan: "Best price on our website",
        telephone: `+91-${CONTACT.business.phone}`,
        email: input.contactEmail,
        ...(listingAddress ? { address: listingPostalAddress(listingAddress) } : {}),
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "High-speed Wi-Fi", value: true },
          { "@type": "LocationFeatureSpecification", name: "On-site parking", value: true },
          { "@type": "LocationFeatureSpecification", name: "Air conditioning", value: true },
          { "@type": "LocationFeatureSpecification", name: "Work-friendly desks", value: true },
        ],
        checkinTime: "14:00",
        checkoutTime: "11:00",
      };

  const faqPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.faqHighlights.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return lodgingBusiness ? [organization, lodgingBusiness, faqPage] : [organization, faqPage];
}
