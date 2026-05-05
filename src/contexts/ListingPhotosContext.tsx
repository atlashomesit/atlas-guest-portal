/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchListingPhotos, fetchPublicListings } from '@/api/listingClient';
import { filterGuestImageUrls, sanitizeGuestImageUrl } from '@/utils/guestImageUrl';

type ListingPhotosContextValue = {
  /** Ordered gallery URLs for a listing id, when known from /listings/public */
  getUrlsForListingId: (listingId: number | undefined | null) => string[] | undefined;
  loaded: boolean;
};

const ListingPhotosContext = createContext<ListingPhotosContextValue>({
  getUrlsForListingId: () => undefined,
  loaded: false,
});

export function ListingPhotosProvider({ children }: { children: React.ReactNode }) {
  const [byListingId, setByListingId] = useState<Map<number, string[]>>(new Map());
  const [loaded, setLoaded] = useState(true);

  const getUrlsForListingId = useCallback(
    (listingId: number | undefined | null) => {
      if (listingId == null || !Number.isFinite(Number(listingId))) return undefined;
      return byListingId.get(Number(listingId));
    },
    [byListingId],
  );

  const value = useMemo(
    () => ({ getUrlsForListingId, loaded }),
    [getUrlsForListingId, loaded],
  );

  return <ListingPhotosContext.Provider value={value}>{children}</ListingPhotosContext.Provider>;
}

export function useListingPhotosFromApi() {
  return useContext(ListingPhotosContext);
}
