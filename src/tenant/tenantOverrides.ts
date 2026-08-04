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
  /** Dialog heading (optional; default "Your privacy choice"). */
  title?: string;
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
  /**
   * Same-origin logo artwork for this tenant (e.g. "/images/<brand>-logo.png").
   * Wins over `tenant.logoUrl` from the API so repo-shipped brand marks stay
   * pixel-exact. Only affects the tenant under this slug — every other tenant
   * keeps its API logo / the brand-neutral LOGO_URL fallback.
   */
  logoUrl?: string;
  /** Same-origin favicon for this tenant; wins over `tenant.faviconUrl`. */
  faviconUrl?: string;
  /** Hide default marketplace / parent-brand copy where we show a listing brand row. */ // TODO(CPO-001-followup): align naming with displayBrand helpers
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
   * GSTIN for the tenant operator — shown in the tourism registration row on
   * property detail pages when set. Leave unset to hide the row.
   */
  gstin?: string;
  /**
   * State-level tourism / homestay registration numbers for the tenant
   * (e.g. ["TS/HS/2024/0227", "KH/2024/0481"]). Shown in the registration
   * row on property detail pages. Leave unset to hide the row entirely.
   */
  tourismRegNumbers?: string[];
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

const TENANT_OVERRIDES: Record<string, TenantOverrides> = {
  // Stay by City Focus — prod branded subdomain staybycf.atlastays.com
  // (subdomain label == tenant slug, TenantsController from-domain resolution).
  // Renamed from `devstaybycf` 2026-08-03: the prod tenant (id 45) was re-slugged
  // gaurav-upreti -> staybycf to serve the customer site, so the old key no longer
  // matched and the brand mark/favicon silently fell back to the API logo.
  // Logo artwork ships same-origin in public/images; scoped here so no other
  // tenant (incl. the atlastays.com marketplace apex) ever renders this mark.
  staybycf: {
    logoUrl: '/images/stay-bycityfocus-logo.png',
    faviconUrl: '/images/stay-bycityfocus-logo.png',
  },
  atlas: {
    // TASK-4300 (founder decision 2026-06-30): canonical guest-facing support WhatsApp =
    // +91-7032493290 (Atlastays platform line). The tenant API returns the Atlas Homes admin
    // number (9502244053) for whatsappBookingPhone, which is NOT the guest support line — pin
    // the override so every wa.me link + displayed number resolves to 7032493290.
    contact: {
      // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- canonical Atlas marketplace WhatsApp; scoped to the `atlas` marketplace slug only, never a white-label tenant
      whatsappPhone: '7032493290',
    },
    mapLocation: {
      lat: 17.4948,
      lng: 78.3996,
      zoom: 15,
      markerLabel: 'Atlas Homes, KPHB',
    },
    locationContent: {
      transport: [
        {
          title: 'Metro',
          details: 'Kukatpally and KPHB Colony Metro stations are within a 10-15 minute drive for quick access across the city.',
        },
        {
          title: 'Airport',
          details: 'Rajiv Gandhi International Airport is about 45 minutes away via ORR, with reliable cab availability day and night.',
        },
        {
          title: 'Road connectivity',
          details: 'Easy access to Mumbai Highway, JNTU Road, and the ORR for commuting towards Hitech City, Gachibowli, or BHEL.',
        },
      ],
      nearbyAmenities: [
        {
          title: 'Daily essentials',
          details: 'Supermarkets, pharmacies, and local bakeries within a 5-10 minute drive for everyday needs.',
        },
        {
          title: 'Dining',
          details: 'A mix of local eateries and popular chains around Kukatpally, JNTU, and KPHB for quick meals or dine-in plans.',
        },
        {
          title: 'Healthcare',
          details: 'Multi-specialty hospitals and clinics nearby to handle routine visits and emergencies.',
        },
      ],
      landmarks: [
        {
          title: 'Business hubs',
          details: 'Proximity to Hitech City, Gachibowli, and Financial District for tech parks and corporate offices.',
        },
        {
          title: 'Education',
          details: 'Universities and colleges around Kukatpally and Miyapur, with straightforward commutes by metro or cab.',
        },
        {
          title: 'Leisure',
          details: 'Shopping streets, malls, and cinemas across KPHB, Miyapur, and Kukatpally for entertainment.',
        },
      ],
    },
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
  if (slug && TENANT_OVERRIDES[slug]) {
    return TENANT_OVERRIDES[slug];
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
  // Default: only the Atlas marketplace tenant keeps Atlas branding. The API's
  // TenantFromDomainDto does not currently emit `isMarketplaceRoot`, so on hosted
  // dev `dev.atlashomestays.com` the atlas tenant was treated as a white-label
  // tenant — Home.tsx then rendered "Atlas | Book your stay" instead of the
  // brand-bearing "Atlas Homestays | Find your perfect stay" fallback, and the
  // ra006-ac5 sanity spec failed. Mirror getGuestDataProcessingEntityName()'s
  // slug-based marketplace detection so the marketplace stays branded everywhere.
  const slug = (tenantHint?.slug ?? "").trim().toLowerCase();
  if (slug === "atlas") return false;
  return !tenantHint?.isMarketplaceRoot;
}
