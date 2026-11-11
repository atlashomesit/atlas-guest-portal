/**
 * CLU-011: `GET /api/public/listings/{parentId}/cluster-children-availability` - for a Whole-Villa
 * parent and a stay window, why the parent is unavailable and which Child rooms are fully free.
 */
import { buildApiUrl, getApiHeaders } from '@/api/client';

export type ClusterChildrenCause = 'None' | 'ChildrenBooked' | 'ParentUnavailable';

export type FreeClusterChild = {
  listingId: number;
  name: string;
  nightlyRate: number | null;
  currency: string;
  coverPhotoUrl: string | null;
};

export type ClusterChildrenAvailability = {
  cause: ClusterChildrenCause;
  totalChildren: number;
  unavailableChildren: number;
  freeChildren: FreeClusterChild[];
};

const CAUSES: ClusterChildrenCause[] = ['None', 'ChildrenBooked', 'ParentUnavailable'];

export function parseClusterChildrenAvailability(raw: unknown): ClusterChildrenAvailability | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const cause = CAUSES.find((c) => c === o.cause);
  if (!cause) return null;
  const free = Array.isArray(o.freeChildren) ? o.freeChildren : [];
  return {
    cause,
    totalChildren: Number(o.totalChildren) || 0,
    unavailableChildren: Number(o.unavailableChildren) || 0,
    freeChildren: free
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
      .map((c) => ({
        listingId: Number(c.listingId),
        name: typeof c.name === 'string' ? c.name : 'Room',
        nightlyRate: c.nightlyRate == null ? null : Number(c.nightlyRate),
        currency: typeof c.currency === 'string' ? c.currency : 'INR',
        coverPhotoUrl: typeof c.coverPhotoUrl === 'string' ? c.coverPhotoUrl : null,
      }))
      .filter((c) => Number.isInteger(c.listingId) && c.listingId > 0),
  };
}

/** Resolves null on any failure (the banner then simply does not render - never a wrong claim). */
export async function fetchClusterChildrenAvailability(
  parentListingId: number,
  startIso: string,
  endIso: string,
  tenantSlug?: string | null,
  signal?: AbortSignal,
): Promise<ClusterChildrenAvailability | null> {
  try {
    const url = new URL(buildApiUrl(`/api/public/listings/${parentListingId}/cluster-children-availability`));
    url.searchParams.set('startDate', startIso);
    url.searchParams.set('endDate', endIso);
    const res = await fetch(url.toString(), { headers: getApiHeaders(tenantSlug), signal });
    if (!res.ok) return null;
    return parseClusterChildrenAvailability(await res.json());
  } catch {
    return null;
  }
}
