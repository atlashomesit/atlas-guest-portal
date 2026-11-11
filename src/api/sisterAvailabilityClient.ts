/**
 * CHN-012 (guest half): `GET /api/public/chain/sister-availability?propertyId=&checkIn=&checkOut=&guests=`.
 *
 * Sister properties of the SAME brand (tenant) that have a bookable unit for the same dates and guest count, offered only
 * when the property the guest is viewing has nothing bookable. Read-only: it suggests, it never holds or books anything.
 * Every amount is the API's (`totalAmount` = the checkout's FinalAmount) and is shown exactly as returned.
 */
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { buildHomeUnitPath, getPropertySlug } from '@/utils/navigation';

export type SisterListingOffer = {
  listingId: number;
  listingName: string;
  maxGuests: number;
  coverPhotoUrl: string | null;
  currency: string;
  /** The public pricing breakdown's FinalAmount for the stay - what checkout will ask the guest to pay. Never recomputed here. */
  totalAmount: number;
  averagePerNight: number;
};

export type SisterPropertyCard = {
  propertyId: number;
  propertyName: string;
  city: string | null;
  state: string | null;
  /** Straight-line km from the sold-out property; null when either has no coordinates. */
  distanceKm: number | null;
  listings: SisterListingOffer[];
};

export type SisterSpillover = {
  sourceSoldOut: boolean;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  properties: SisterPropertyCard[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const asNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Null for anything that is not the response shape. Units without a real id, name or price are dropped; so are properties left with none. */
export function parseSisterSpillover(raw: unknown): SisterSpillover | null {
  const o = asRecord(raw);
  if (!o || !Array.isArray(o.properties)) return null;

  const properties: SisterPropertyCard[] = [];
  for (const p of o.properties) {
    const pr = asRecord(p);
    if (!pr) continue;
    const propertyId = Number(pr.propertyId);
    const propertyName = asText(pr.propertyName);
    if (!Number.isInteger(propertyId) || propertyId <= 0 || !propertyName) continue;

    const listings: SisterListingOffer[] = [];
    for (const l of Array.isArray(pr.listings) ? pr.listings : []) {
      const lr = asRecord(l);
      if (!lr) continue;
      const listingId = Number(lr.listingId);
      const listingName = asText(lr.listingName);
      const totalAmount = asNumberOrNull(lr.totalAmount);
      if (!Number.isInteger(listingId) || listingId <= 0 || !listingName || totalAmount === null) continue;
      listings.push({
        listingId,
        listingName,
        maxGuests: asNumberOrNull(lr.maxGuests) ?? 0,
        coverPhotoUrl: asText(lr.coverPhotoUrl),
        currency: asText(lr.currency) ?? 'INR',
        totalAmount,
        averagePerNight: asNumberOrNull(lr.averagePerNight) ?? 0,
      });
    }
    if (listings.length === 0) continue;

    properties.push({
      propertyId,
      propertyName,
      city: asText(pr.city),
      state: asText(pr.state),
      distanceKm: asNumberOrNull(pr.distanceKm),
      listings,
    });
  }

  return {
    // Fail-safe: only an explicit true counts. A missing flag shows nothing.
    sourceSoldOut: o.sourceSoldOut === true,
    checkIn: asText(o.checkIn) ?? '',
    checkOut: asText(o.checkOut) ?? '',
    nights: asNumberOrNull(o.nights) ?? 0,
    guests: asNumberOrNull(o.guests) ?? 0,
    properties,
  };
}

/** Resolves null on any failure (no cards then render - never a wrong claim). */
export async function fetchSisterAvailability(
  propertyId: number,
  checkInIso: string,
  checkOutIso: string,
  guests: number,
  tenantSlug?: string | null,
  signal?: AbortSignal,
): Promise<SisterSpillover | null> {
  try {
    const url = new URL(buildApiUrl('/api/public/chain/sister-availability'));
    url.searchParams.set('propertyId', String(propertyId));
    url.searchParams.set('checkIn', checkInIso);
    url.searchParams.set('checkOut', checkOutIso);
    url.searchParams.set('guests', String(guests));
    const res = await fetch(url.toString(), { headers: getApiHeaders(tenantSlug), signal });
    if (!res.ok) return null;
    return parseSisterSpillover(await res.json());
  } catch {
    return null;
  }
}

/** `/homes/{propertySlug}/{listingId}?checkIn=&checkOut=&guests=` (dates only when both are known). */
export function buildSisterListingHref(
  property: Pick<SisterPropertyCard, 'propertyName'>,
  listingId: number,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  guests: number,
  tenantSlug?: string | null,
): string {
  const params: string[] = [];
  if (checkIn && checkOut) {
    params.push(`checkIn=${encodeURIComponent(checkIn)}`, `checkOut=${encodeURIComponent(checkOut)}`);
  }
  if (Number.isInteger(guests) && guests > 0) params.push(`guests=${guests}`);
  if (tenantSlug) params.push(`tenant=${encodeURIComponent(tenantSlug)}`);
  const base = buildHomeUnitPath(getPropertySlug({ property_name: property.propertyName }), listingId);
  return params.length > 0 ? `${base}?${params.join('&')}` : base;
}
