import { useState, useEffect } from 'react';
import { fetchPublicListings, type PublicListing } from '../api/listingClient';
import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides } from '../tenant/tenantOverrides';
import { buildHomeUnitPath, getPropertySlug } from '../utils/navigation';

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
        const listings = await fetchPublicListings();
        const overrides = getTenantOverrides(tenant?.slug);
        const tenantAllowedIds = new Set((overrides.homes ?? []).map(h => Number(h.roomNo)));

        let filtered = listings;
        if (tenantAllowedIds.size > 0) {
          filtered = listings.filter(l => tenantAllowedIds.has(l.id));
        }

        const mapped = filtered.map(mapPublicListingToHomeLink);
        mapped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        setHomes(mapped);
        const byId: Record<string, PublicListing> = {};
        for (const l of filtered) byId[String(l.id)] = l;
        setListingsById(byId);
      } catch (error) {
        console.warn('Error fetching listings:', error);
        setUsedFallback(true);
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
