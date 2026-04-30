import { useState, useEffect } from 'react';
import { getTenantContext } from '../tenant/tenantContext';

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

const LISTINGS_API_URL = 'https://atlas-homes-api-gxdqfjc2btc0atbv.centralus-01.azurewebsites.net/listings/public';

export function usePropertyListings(): HomeLink[] {
  const [homes, setHomes] = useState<HomeLink[]>([]);
  const tenant = getTenantContext();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch(LISTINGS_API_URL);
        if (!response.ok) {
          console.warn('Failed to fetch listings:', response.status);
          return;
        }

        const listings: PropertyListing[] = await response.json();

        // Filter listings for the current property (use tenant name if available)
        const propertyName = tenant?.name || 'Star Guest House';
        const propertyListings = listings.filter(
          listing => listing.propertyName === propertyName
        );

        // Map listings to HomeLink format
        const mappedHomes: HomeLink[] = propertyListings.map(listing => ({
          roomNo: listing.id.toString(),
          title: listing.name,
          href: `/homes/${listing.name.toLowerCase().replace(/_/g, '-')}`,
        }));

        setHomes(mappedHomes);
      } catch (error) {
        console.warn('Error fetching listings:', error);
      }
    };

    fetchListings();
  }, [tenant?.name]);

  return homes;
}
