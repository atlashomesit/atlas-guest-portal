import { useEffect, useState } from 'react';
import { fetchListingById } from '@/api/listingClient';
import { resolveHostListingDescription } from '@/utils/listingDescription';

export type ListingHostDescription = {
  /** Host-authored description (see resolveHostListingDescription); '' when none was written. */
  text: string;
  /**
   * False while GET /listings/{id} is still pending for THIS listing id. Lets the page hold back
   * the "host hasn't added a description" empty state instead of flashing it and then swapping in
   * the real description a moment later.
   */
  loaded: boolean;
};

/**
 * "About this home" text for the listing page: the description the host entered under
 * Rooms & prices → Listing details, read from GET /listings/{id}.
 *
 * `fetchListingById` shares one in-flight / short-TTL request per URL (dedupedJsonFetch) with the
 * page's other GET /listings/{id} readers, so this adds no network call. The text is held here,
 * keyed by listing id, rather than patched onto the page's `data` row: that row is replaced
 * wholesale when GET /listings/public resolves, which would silently drop the description again.
 */
export function useListingHostDescription(listingId: number | null | undefined): ListingHostDescription {
  const id = typeof listingId === 'number' && Number.isFinite(listingId) && listingId > 0 ? listingId : null;
  const [result, setResult] = useState<{ listingId: number; text: string } | null>(null);

  useEffect(() => {
    if (id == null) return;
    const ac = new AbortController();
    fetchListingById(id, ac.signal)
      .then((detail) => {
        if (!ac.signal.aborted) setResult({ listingId: id, text: resolveHostListingDescription(detail) });
      })
      .catch(() => {
        if (!ac.signal.aborted) setResult({ listingId: id, text: '' });
      });
    return () => ac.abort();
  }, [id]);

  const current = id != null && result?.listingId === id ? result : null;
  // No resolvable listing id means there is nothing to wait for.
  return { text: current?.text ?? '', loaded: id == null || current != null };
}
