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

export type TenantMapLocation = {
  lat: number;
  lng: number;
  /** Label shown on the map marker. */
  markerLabel?: string;
  /** Zoom level (default 15). */
  zoom?: number;
};

export type TenantLocationSection = {
  title: string;
  details: string;
};

export type TenantLocationContent = {
  /** Page subtitle shown below the "Location & Neighborhood" heading. */
  subtitle?: string;
  transport?: TenantLocationSection[];
  nearbyAmenities?: TenantLocationSection[];
  landmarks?: TenantLocationSection[];
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
  /** Coordinates and zoom for the Location page map pin. */
  mapLocation?: TenantMapLocation;
  /** Copy blocks for the Location page (transport, amenities, landmarks). */
  locationContent?: TenantLocationContent;
  /**
   * Noun used to refer to a stayable unit. Drives copy like "Our Homes",
   * "View home", "No homestays match…". Default = home/homes for Atlas.
   * For room-stay tenants (e.g. guest houses), set to room/rooms.
   */
  unitNoun?: {
    singular: string;
    plural: string;
    /** Capitalized variants for headings/buttons (e.g. "Home", "Homes"). */
    capitalSingular: string;
    capitalPlural: string;
    /**
     * Noun used in marketing/empty-state copy ("homestays match", "stays").
     * Defaults to plural when omitted.
     */
    marketingPlural?: string;
  };
};

/** Default unit noun (Atlas marketplace). */
export const DEFAULT_UNIT_NOUN = {
  singular: 'home',
  plural: 'homes',
  capitalSingular: 'Home',
  capitalPlural: 'Homes',
  marketingPlural: 'homestays',
} as const;

/** Resolve the unit noun for the active tenant overrides, falling back to defaults. */
export function getUnitNoun(overrides: TenantOverrides): {
  singular: string;
  plural: string;
  capitalSingular: string;
  capitalPlural: string;
  marketingPlural: string;
} {
  const n = overrides.unitNoun;
  if (!n) return DEFAULT_UNIT_NOUN;
  return {
    singular: n.singular,
    plural: n.plural,
    capitalSingular: n.capitalSingular,
    capitalPlural: n.capitalPlural,
    marketingPlural: n.marketingPlural ?? n.plural,
  };
}

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
    // Star Guest House is a room-stay (not a homestay) — use "room"/"rooms"
    unitNoun: {
      singular: 'room',
      plural: 'rooms',
      capitalSingular: 'Room',
      capitalPlural: 'Rooms',
      marketingPlural: 'rooms',
    },
    mapLocation: {
      lat: 17.467607975653657,
      lng: 78.36671473489571,
      markerLabel: 'Star Guest House',
      zoom: 15,
    },
    locationContent: {
      subtitle:
        'Find transport options, nearby dining, shopping, and corporate hubs close to Star Guest House so you can plan your arrival and daily commute with ease.',
      transport: [
        {
          title: 'Metro',
          details: 'Hitech City and Raidurg Metro stations are within 10 minutes for quick access across the city.',
        },
        {
          title: 'Airport',
          details: 'Rajiv Gandhi International Airport is about 30 minutes away with reliable cab availability day and night.',
        },
        {
          title: 'Road connectivity',
          details: 'Easy access to Gachibowli, Hitech City, Miyapur, and ORR towards Financial District and Manikonda.',
        },
      ],
      nearbyAmenities: [
        {
          title: 'Daily essentials',
          details: 'Nearby Ratnadeep supermarket, pharmacies, and local bakeries for everyday needs.',
        },
        {
          title: 'Dining',
          details: 'Restaurants and eateries in Kondapur, Hitech City, Raidurg, Gachibowli, Madhapur, and Miyapur.',
        },
        {
          title: 'Healthcare',
          details: 'KIIMS Hospital and Apollo Hospital nearby to handle routine visits and emergencies.',
        },
      ],
      landmarks: [
        {
          title: 'Business hubs',
          details: 'Proximity to Hitech City, Gachibowli, Manikonda, and Financial District for tech parks and corporate offices.',
        },
        {
          title: 'Transport hubs',
          details: 'Close to Raidurg and Miyapur with excellent connectivity via metro and road networks.',
        },
        {
          title: 'Premium localities',
          details: 'Located in a prime area with easy access to Hitech City and Financial District.',
        },
      ],
    },
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

/**
 * RA-006 §3.5/§3.6: should we hide Atlas-Homes brand strings (footer brand,
 * social links, "Atlas Homes" badges) for the current tenant?
 *
 * Resolution order:
 *   1. Per-slug override (`hideAtlasHomesBranding`) wins if set explicitly to true/false.
 *   2. Otherwise default to *hidden* unless the tenant is the marketplace root
 *      (atlas itself), so any new tenant subdomain gets white-label by default
 *      without an engineer adding a TENANT_OVERRIDES entry.
 *
 * `tenantHint` accepts the minimum shape we need (slug + isMarketplaceRoot) so
 * callers don't need to import the full TenantInfo type.
 */
export function shouldHideAtlasBranding(
  tenantHint: { slug?: string | null; isMarketplaceRoot?: boolean | null } | null | undefined,
  overrides: TenantOverrides,
): boolean {
  if (overrides.hideAtlasHomesBranding === true) return true;
  if (overrides.hideAtlasHomesBranding === false) return false;
  // Default: only the Atlas marketplace root keeps Atlas branding.
  return !tenantHint?.isMarketplaceRoot;
}
