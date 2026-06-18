import { buildApiUrl } from '@/api/client';
import { filterGuestImageUrls, sanitizeGuestImageUrl } from '@/utils/guestImageUrl';

export type MarketplaceCoverItem = {
  id: number;
  tenantSlug: string;
  coverImageUrl?: string | null;
};

type ListingCoverResponse = {
  coverPhotoUrl?: string | null;
  photoUrls?: string[] | null;
};

/** When /marketplace/listings omits coverImageUrl, resolve from tenant-scoped GET /listings/{id}. */
export async function enrichMarketplaceCoverItems<T extends MarketplaceCoverItem>(
  items: T[],
): Promise<T[]> {
  const missing = items.filter((item) => !sanitizeGuestImageUrl(item.coverImageUrl));
  if (missing.length === 0) return items;

  const coverByListingId = new Map<number, string>();

  await Promise.all(
    missing.map(async (item) => {
      const slug = item.tenantSlug?.trim();
      if (!slug || item.id <= 0) return;
      try {
        const res = await fetch(buildApiUrl(`/listings/${item.id}`), {
          headers: { 'X-Tenant-Slug': slug, Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = (await res.json()) as ListingCoverResponse;
        const url =
          sanitizeGuestImageUrl(data.coverPhotoUrl) ??
          filterGuestImageUrls(data.photoUrls ?? [])[0];
        if (url) coverByListingId.set(item.id, url);
      } catch {
        /* cover is optional */
      }
    }),
  );

  if (coverByListingId.size === 0) return items;

  return items.map((item) => {
    const resolved = coverByListingId.get(item.id);
    return resolved ? { ...item, coverImageUrl: resolved } : item;
  });
}
