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

        // Deduplicate by propertyId to avoid redundant API calls
        const photosByPropertyId = new Map<number, string[]>();
        const uniquePropertyIds = [
          ...new Set(listings.map(l => l.propertyId).filter((id): id is number => id != null && id > 0))
        ];

        // Fetch photos for each unique property once
        await Promise.all(
          uniquePropertyIds.map(async (propertyId) => {
            try {
              const urls = filterGuestImageUrls(
                await fetchListingPhotos(propertyId, undefined),
              );
              if (urls.length > 0) photosByPropertyId.set(propertyId, urls);
            } catch {
              /* fall back to public DTO fields */
            }
          }),
        );

        // Map photos to each listing
        for (const l of listings) {
          if (l.id <= 0) continue;
          let urls: string[] = [];
          const propertyId = l.propertyId ?? 0;

          // Try photos endpoint first
          if (propertyId > 0 && photosByPropertyId.has(propertyId)) {
            const fromPhotos = photosByPropertyId.get(propertyId) ?? [];
            if (fromPhotos.length > 0) urls = fromPhotos;
          }

          // Fall back to DTO fields if needed
          if (urls.length === 0) {
            const ordered = filterGuestImageUrls((l.photoUrls ?? []).filter(Boolean));
            const cover = sanitizeGuestImageUrl(l.coverPhotoUrl);
            urls = ordered.length > 0 ? ordered : cover ? [cover] : [];
          }
          if (urls.length > 0) next.set(l.id, urls);
        }

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
