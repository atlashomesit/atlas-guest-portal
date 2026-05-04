/**
 * Per-tenant overrides for guest-portal UI/content that the tenant API
 * does not (yet) carry. Keyed by tenant slug. All fields are optional —
 * callers fall back to defaults when a slug is not found or a field is
 * absent. Other tenants are unaffected by entries added here.
 */

// Inline re-export of FaqHighlight to avoid circular deps with content/faqHighlights.ts
export type TenantFaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type TenantHomeLink = {
  /** Unique key for the dropdown entry (used as React key). */
  roomNo: string;
  /** Display label in the dropdown. */
  title: string;
  /** Route to navigate to when clicked. */
  href: string;
};

export type TenantContactOverrides = {
  /** Primary business phone, digits only, no country code (e.g. "7799779192"). */
  businessPhone?: string;
  /** Owner / escalation phone, digits only, no country code. */
  ownerPhone?: string;
  /** WhatsApp number, digits only, no country code. Defaults to businessPhone. */
  whatsappPhone?: string;
  /** Public contact email. */
  email?: string;
  /** Physical address. */
  address?: string;
};

export type TenantDirectBookingPromo = {
  /** When false, strip is hidden even on marketplace theme. */
  enabled?: boolean;
  headline?: string;
  subline?: string;
};

export type TenantCookieBanner = {
  /** Full consent text shown in the banner body. */
  text: string;
  /** URL to the tenant's privacy notice. */
  privacyUrl: string;
  /** Label for the privacy notice link (default: "privacy notice"). */
  privacyLinkLabel?: string;
};

export type TenantOverrides = {
  /** Hide the logo image in the navbar/footer/subheading. */
  hideLogo?: boolean;
  /** Hide default "Atlas Homes" / Atlas Homestays copy where we show a listing brand row. */
  hideAtlasHomesBranding?: boolean;
  /** Hide the "List your property" CTA in the header (desktop + mobile). */
  hideListProperty?: boolean;
  /**
   * When true, search and listing surfaces use only the public listings API — no bundled
   * `propertyData` fallback if the request fails or returns empty.
   */
  onlyApiListings?: boolean;
  /**
   * If set, public listing results (search, hooks, homepage API path) are restricted to these
   * numeric listing IDs. Prefer this over `homes` when labels/routes come entirely from the API.
   */
  publicListingIdAllowlist?: number[];
  /** Override the "Our Homes" dropdown contents. */
  homes?: TenantHomeLink[];
  /** Override contact details (phone numbers, email). */
  contact?: TenantContactOverrides;
  /** Listings API endpoint URL (e.g., https://api.example.com/listings/public). */
  listingsApiUrl?: string;
  /** TASK-1293: homepage strip above hero (direct booking value prop). */
  directBookingPromo?: TenantDirectBookingPromo;
  /** TASK-1877: white-label cookie banner copy + privacy link override. */
  cookieBanner?: TenantCookieBanner;
  /** TASK-1878: tenant-specific FAQ entries — replaces Atlas defaults when set. */
  faq?: TenantFaqEntry[];
};

/** Star Guest House public listing IDs from API (9-29). */
const STAR_GUEST_HOUSE_LISTING_IDS: number[] = [
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
];

const TENANT_OVERRIDES: Record<string, TenantOverrides> = {
  starguesthouse: {
    hideLogo: true,
    hideAtlasHomesBranding: true,
    hideListProperty: true,
    onlyApiListings: true,
    publicListingIdAllowlist: STAR_GUEST_HOUSE_LISTING_IDS,
    contact: {
      address: 'Shop No 2, 10, opposite Shilpa Park, Kondapur, Hanuman Nagar, Telangana 500084',
      businessPhone: '7799779192',
      ownerPhone: '7799779192',
      whatsappPhone: '7799779192',
      email: 'starguesthousekondapur@gmail.com',
    },
    // TASK-1877: white-label cookie banner with tenant-specific copy + privacy link
    cookieBanner: {
      text:
        'We use strictly necessary cookies to make this site work, and optional analytics cookies ' +
        "to understand how it's used. Under India's DPDP Act 2023 we ask for your consent before " +
        'loading anything non-essential. Read our',
      privacyUrl: '/privacy',
      privacyLinkLabel: 'privacy notice',
    },
    // TASK-1878: tenant-specific FAQ entries for Star Guest House, Kondapur
    faq: [
      {
        id: 'sgh-checkin-checkout',
        question: 'How do check-in and check-out work?',
        answer:
          'Check-in is from 2:00 PM and check-out is by 11:00 AM. Self check-in with ID is supported. Early or late arrangements can be made based on availability — contact us on WhatsApp.',
      },
      {
        id: 'sgh-cancellation',
        question: 'What is the cancellation and change policy?',
        answer:
          'Date changes are allowed when the room is available. Cancellations follow the notice-based policy shown at the time of booking. Refunds are processed within 5–7 business days.',
      },
      {
        id: 'sgh-wifi-amenities',
        question: 'Is Wi-Fi included? What other amenities are available?',
        answer:
          'Yes, high-speed Wi-Fi is included in all rooms. Rooms include AC, TV, geyser, and daily housekeeping. Parking is available on-site on a first-come basis.',
      },
      {
        id: 'sgh-meals',
        question: 'Are meals or kitchen access available?',
        answer:
          'Star Guest House does not provide meals. A shared kitchen facility is available for guests. Kondapur has excellent dining options within walking distance.',
      },
      {
        id: 'sgh-long-stay',
        question: 'Do you offer monthly or long-stay rates?',
        answer:
          'Yes, we offer discounted monthly rates for stays of 30 nights or more. Contact us directly on WhatsApp at 7799779192 to get a custom quote for extended stays.',
      },
      {
        id: 'sgh-contact',
        question: 'How can I reach Star Guest House during my stay?',
        answer:
          'WhatsApp or call us at 7799779192 for any assistance. Our team is available 9 AM–9 PM. For after-hours emergencies, the owner line is the same number.',
      },
    ],
  },
};

const EMPTY_OVERRIDES: TenantOverrides = {};

/** IDs used to filter `fetchPublicListings` for this tenant (API listing `id`). */
export function getTenantPublicListingIdAllowlist(overrides: TenantOverrides): Set<number> {
  const explicit = overrides.publicListingIdAllowlist;
  if (explicit?.length) {
    return new Set(explicit.filter((n) => Number.isFinite(n) && n > 0));
  }
  return new Set(
    (overrides.homes ?? [])
      .map((h) => Number(h.roomNo))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

export function getTenantOverrides(slug?: string | null): TenantOverrides {
  // Check overrides by slug first
  if (slug && TENANT_OVERRIDES[slug]) {
    return TENANT_OVERRIDES[slug];
  }

  // Fallback: check hostname for domain-based overrides
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('starguesthouse')) {
      return TENANT_OVERRIDES.starguesthouse;
    }
  }

  return EMPTY_OVERRIDES;
}
