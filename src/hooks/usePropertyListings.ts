import { useState, useEffect } from 'react';
import { fetchPublicListings } from '../api/listingClient';
import { getTenantContext } from '../tenant/tenantContext';
import { buildHomeUnitPath, getPropertySlug } from '../utils/navigation';

export type HomeLink = {
  roomNo: string;
  title: string;
  href: string;
};

export type PropertyListingsState = {
  homes: HomeLink[];
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
  const [isLoading, setIsLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const tenant = getTenantContext();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setUsedFallback(false);
      try {
        const listings = await fetchPublicListings();
        const mapped = listings.map(mapPublicListingToHomeLink);
        mapped.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
        setHomes(mapped);
      } catch (error) {
        console.warn('Error fetching listings:', error);
        setUsedFallback(true);
        setHomes([]);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [tenant?.slug]);

  return { homes, isLoading, usedFallback };
}
