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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicListings()
      .then(async (listings) => {
        if (cancelled) return;
        const next = new Map<number, string[]>();

        await Promise.all(
          listings.map(async (l) => {
            if (l.id <= 0) return;
            let urls: string[] = [];
            try {
              const fromPhotos = filterGuestImageUrls(
                await fetchListingPhotos(l.propertyId ?? 0, undefined, { listingId: l.id }),
              );
              if (fromPhotos.length > 0) urls = fromPhotos;
            } catch {
              /* fall back to public DTO fields */
            }
            if (urls.length === 0) {
              const ordered = filterGuestImageUrls((l.photoUrls ?? []).filter(Boolean));
              const cover = sanitizeGuestImageUrl(l.coverPhotoUrl);
              urls = ordered.length > 0 ? ordered : cover ? [cover] : [];
            }
            if (urls.length > 0) next.set(l.id, urls);
          }),
        );

        if (cancelled) return;
        setByListingId(next);
      })
      .catch(() => {
        /* keep static fallbacks in consumers */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
