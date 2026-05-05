/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ListingPhotosContextValue = {
  getUrlsForListingId: (listingId: number | undefined | null) => string[] | undefined;
  setCachedPhotos: (listingId: number, urls: string[]) => void;
};

const ListingPhotosContext = createContext<ListingPhotosContextValue>({
  getUrlsForListingId: () => undefined,
  setCachedPhotos: () => {},
});

export function ListingPhotosProvider({ children }: { children: React.ReactNode }) {
  const [byListingId, setByListingId] = useState<Map<number, string[]>>(new Map());

  const getUrlsForListingId = useCallback(
    (listingId: number | undefined | null) => {
      if (listingId == null || !Number.isFinite(Number(listingId))) return undefined;
      return byListingId.get(Number(listingId));
    },
    [byListingId],
  );

  const setCachedPhotos = useCallback(
    (listingId: number, urls: string[]) => {
      setByListingId((prev) => {
        const next = new Map(prev);
        next.set(listingId, urls);
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ getUrlsForListingId, setCachedPhotos }),
    [getUrlsForListingId, setCachedPhotos],
  );

  return <ListingPhotosContext.Provider value={value}>{children}</ListingPhotosContext.Provider>;
}

export function useListingPhotosFromApi() {
  return useContext(ListingPhotosContext);
}
