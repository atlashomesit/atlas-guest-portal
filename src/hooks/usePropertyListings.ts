import { useState, useEffect } from 'react';
import { fetchPublicListings, type PublicListing } from '../api/listingClient';
import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides, getTenantPublicListingIdAllowlist } from '../tenant/tenantOverrides';
import { buildHomeUnitPath, getPropertySlug } from '../utils/navigation';
import { getCurrentLanguage } from '../i18n/i18n';

export type HomeLink = {
  roomNo: string;
  title: string;
  href: string;
};

export type PropertyListingsState = {
  homes: HomeLink[];
  /** Full API listing objects, keyed by listing id string. Available for components needing rich data (e.g. JSON-LD). */
  listingsById: Record<string, PublicListing>;
  isLoading: boolean;
  /** True when the API request failed and static tenant/default homes are shown instead. */
  usedFallback: boolean;
};

function mapPublicListingToHomeLink(listing: {
  id: number;
  name?: string;
  propertyName?: string;
}): HomeLink {
  const propertySlug = getPropertySlug({
    property_name: listing.propertyName,
    name: listing.name,
  });
  return {
    roomNo: String(listing.id),
    title: listing.name?.trim() || `Listing ${listing.id}`,
    href: buildHomeUnitPath(propertySlug, listing.id),
  };
}

export function usePropertyListings(): PropertyListingsState {
  const [homes, setHomes] = useState<HomeLink[]>([]);
  const [listingsById, setListingsById] = useState<Record<string, PublicListing>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const tenant = getTenantContext();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setUsedFallback(false);
      try {
        const currentLang = getCurrentLanguage();
        const listings = await fetchPublicListings(undefined, { locale: currentLang });
        const overrides = getTenantOverrides(tenant?.slug);
        const tenantAllowedIds = getTenantPublicListingIdAllowlist(overrides);

        let filtered = listings;
        if (tenantAllowedIds.size > 0) {
          filtered = listings.filter((l) => tenantAllowedIds.has(l.id));
        }

        const mapped = filtered.map(mapPublicListingToHomeLink);
        mapped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        setHomes(mapped);
        const byId: Record<string, PublicListing> = {};
        for (const l of filtered) byId[String(l.id)] = l;
        setListingsById(byId);
      } catch (error) {
        console.error('Error fetching /listings/public:', error);
        const overrides = getTenantOverrides(tenant?.slug);
        const shouldUseFallback = overrides.onlyApiListings !== true;
        console.warn(`API failed. Using fallback: ${shouldUseFallback}`);
        setUsedFallback(shouldUseFallback);
        setHomes([]);
        setListingsById({});
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [tenant?.slug]);

  return { homes, listingsById, isLoading, usedFallback };
}
