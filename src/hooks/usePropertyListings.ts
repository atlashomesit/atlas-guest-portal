import { useState, useEffect } from 'react';
import { getTenantContext } from '../tenant/tenantContext';
import { getTenantOverrides } from '../tenant/tenantOverrides';

export type PropertyListing = {
  id: number;
  name: string;
  propertyName: string;
  floor?: number;
  type?: string;
};

export type HomeLink = {
  roomNo: string;
  title: string;
  href: string;
};

const API_BASE_URL = 'https://atlas-homes-api-gxdqfjc2btc0atbv.centralus-01.azurewebsites.net';

export function usePropertyListings(): HomeLink[] {
  const [homes, setHomes] = useState<HomeLink[]>([]);
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        // Construct tenant-specific API URL
        const tenantSlug = tenant?.slug || 'default';
        const listingsApiUrl = `${API_BASE_URL}/listings/${tenantSlug}/public`;

        const response = await fetch(listingsApiUrl);
        if (!response.ok) {
          console.warn('Failed to fetch listings:', response.status, listingsApiUrl);
          // Fallback to hardcoded overrides if API returns error
          if (overrides.homes) {
            setHomes(overrides.homes);
          }
          return;
        }

        const listings: PropertyListing[] = await response.json();

        // Filter listings for the current property (use tenant name if available)
        const propertyName = tenant?.name || 'Star Guest House';
        const propertyListings = listings.filter(
          listing => listing.propertyName === propertyName
        );

        // If API returns no listings or filtered results are empty, use hardcoded overrides
        if (propertyListings.length === 0 && overrides.homes) {
          setHomes(overrides.homes);
          return;
        }

        // Map listings to HomeLink format
        const mappedHomes: HomeLink[] = propertyListings.map(listing => ({
          roomNo: listing.id.toString(),
          title: listing.name,
          href: `/homes/${listing.name.toLowerCase().replace(/_/g, '-')}`,
        }));

        setHomes(mappedHomes);
      } catch (error) {
        console.warn('Error fetching listings:', error);
        // Fallback to hardcoded overrides if API call fails
        if (overrides.homes) {
          setHomes(overrides.homes);
        }
      }
    };

    fetchListings();
  }, [tenant?.name, tenant?.slug, overrides.homes]);

  return homes;
}
