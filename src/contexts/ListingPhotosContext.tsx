/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ListingPhotosContextValue = {
  getUrlsForListingId: (listingId: number | undefined | null) => string[] | undefined;
};

const ListingPhotosContext = createContext<ListingPhotosContextValue>({
  getUrlsForListingId: () => undefined,
});

export function ListingPhotosProvider({ children }: { children: React.ReactNode }) {
  const [byListingId] = useState<Map<number, string[]>>(new Map());

  const getUrlsForListingId = useCallback(
    (listingId: number | undefined | null) => {
      if (listingId == null || !Number.isFinite(Number(listingId))) return undefined;
      return byListingId.get(Number(listingId));
    },
    [byListingId],
  );

  const value = useMemo(
    () => ({ getUrlsForListingId }),
    [getUrlsForListingId],
  );

  return <ListingPhotosContext.Provider value={value}>{children}</ListingPhotosContext.Provider>;
}

export function useListingPhotosFromApi() {
  return useContext(ListingPhotosContext);
}
