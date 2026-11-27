export type SplitStayLegDto = {
  listingId: number;
  tenantSlug: string;
  tenantName?: string;
  title: string;
  city?: string | null;
  imageUrl?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight?: number | null;
  totalPrice?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
};

export type SplitStayPairDto = {
  id: string;
  changeoverDate: string;
  leg1: SplitStayLegDto;
  leg2: SplitStayLegDto;
  distanceKm?: number | null;
  combinedTotal?: number | null;
};

export type SplitStayCandidateListing = {
  id: number;
  tenantSlug: string;
  tenantName?: string;
  title?: string | null;
  name?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
  pricePerNight?: number | null;
  maxGuests?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
  blockedDates?: string[] | null;
  availableDates?: string[] | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseIsoDateUtc(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatIsoDateUtc(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffNightsIso(checkIn: string, checkOut: string): number {
  const a = parseIsoDateUtc(checkIn);
  const b = parseIsoDateUtc(checkOut);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function addDaysIso(iso: string, days: number): string | null {
  const dt = parseIsoDateUtc(iso);
  if (!dt) return null;
  return formatIsoDateUtc(new Date(dt.getTime() + days * MS_PER_DAY));
}

export function enumerateNightsIso(checkIn: string, checkOut: string): string[] {
  const n = diffNightsIso(checkIn, checkOut);
  if (n <= 0) return [];
  const start = parseIsoDateUtc(checkIn);
  if (!start) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(formatIsoDateUtc(new Date(start.getTime() + i * MS_PER_DAY)));
  }
  return out;
}

export function haversineDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2?: number | null,
  lon2?: number | null,
): number | null {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function isListingOpenForNights(listing: SplitStayCandidateListing, nights: string[]): boolean {
  if (nights.length === 0) return false;
  if (Array.isArray(listing.blockedDates) && listing.blockedDates.length > 0) {
    const blocked = new Set(listing.blockedDates);
    if (nights.some((d) => blocked.has(d))) return false;
  }
  if (Array.isArray(listing.availableDates) && listing.availableDates.length > 0) {
    const avail = new Set(listing.availableDates);
    if (!nights.every((d) => avail.has(d))) return false;
  }
  return true;
}

function areListingsCompatibleDestination(
  a: SplitStayCandidateListing,
  b: SplitStayCandidateListing,
): { ok: boolean; distanceKm: number | null } {
  const dist = haversineDistanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
  if (dist != null) {
    return { ok: dist <= 15, distanceKm: dist };
  }
  const cityA = a.city?.trim().toLowerCase();
  const cityB = b.city?.trim().toLowerCase();
  if (cityA && cityB && cityA === cityB) {
    return { ok: true, distanceKm: null };
  }
  return { ok: false, distanceKm: null };
}

/**
 * MKT-072: Client-side pairing of two consecutive available homes in the same destination
 * for dated searches of >= 4 nights when exact full-stretch results are sparse (< 3).
 * Enforces >= 2 nights per leg, guest capacity, city/15km proximity, and zero blocked-date overlap.
 */
export function buildClientSplitStayPairs(
  candidates: SplitStayCandidateListing[],
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  guests = 1,
  maxPairs = 5,
): SplitStayPairDto[] {
  if (!checkIn || !checkOut) return [];
  const totalNights = diffNightsIso(checkIn, checkOut);
  if (totalNights < 4) return [];

  const eligible = candidates.filter(
    (c) => c.maxGuests == null || c.maxGuests <= 0 || c.maxGuests >= guests,
  );
  if (eligible.length < 2) return [];

  const leg1NightsCount = Math.floor(totalNights / 2);
  const leg2NightsCount = totalNights - leg1NightsCount;
  if (leg1NightsCount < 2 || leg2NightsCount < 2) return [];

  const splitDate = addDaysIso(checkIn, leg1NightsCount);
  if (!splitDate) return [];

  const leg1Nights = enumerateNightsIso(checkIn, splitDate);
  const leg2Nights = enumerateNightsIso(splitDate, checkOut);

  const pairs: SplitStayPairDto[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < eligible.length && pairs.length < maxPairs; i++) {
    const a = eligible[i];
    if (!isListingOpenForNights(a, leg1Nights)) continue;

    for (let j = 0; j < eligible.length && pairs.length < maxPairs; j++) {
      if (i === j) continue;
      const b = eligible[j];
      if (a.id === b.id) continue;
      if (!isListingOpenForNights(b, leg2Nights)) continue;

      const dest = areListingsCompatibleDestination(a, b);
      if (!dest.ok) continue;

      const pairKey = `${a.id}-${b.id}-${splitDate}`;
      if (usedKeys.has(pairKey)) continue;
      usedKeys.add(pairKey);

      const p1 = typeof a.pricePerNight === 'number' && a.pricePerNight > 0 ? a.pricePerNight : null;
      const p2 = typeof b.pricePerNight === 'number' && b.pricePerNight > 0 ? b.pricePerNight : null;
      const total1 = p1 != null ? p1 * leg1NightsCount : null;
      const total2 = p2 != null ? p2 * leg2NightsCount : null;
      const combinedTotal = total1 != null && total2 != null ? total1 + total2 : null;

      pairs.push({
        id: pairKey,
        changeoverDate: splitDate,
        distanceKm: dest.distanceKm,
        combinedTotal,
        leg1: {
          listingId: a.id,
          tenantSlug: a.tenantSlug,
          tenantName: a.tenantName,
          title: a.title?.trim() || a.name?.trim() || a.tenantName || `Stay #${a.id}`,
          city: a.city ?? null,
          imageUrl: a.coverImageUrl || a.imageUrl || null,
          checkIn,
          checkOut: splitDate,
          nights: leg1NightsCount,
          pricePerNight: p1,
          totalPrice: total1,
          latitude: a.latitude ?? null,
          longitude: a.longitude ?? null,
          slug: a.slug ?? String(a.id),
        },
        leg2: {
          listingId: b.id,
          tenantSlug: b.tenantSlug,
          tenantName: b.tenantName,
          title: b.title?.trim() || b.name?.trim() || b.tenantName || `Stay #${b.id}`,
          city: b.city ?? null,
          imageUrl: b.coverImageUrl || b.imageUrl || null,
          checkIn: splitDate,
          checkOut,
          nights: leg2NightsCount,
          pricePerNight: p2,
          totalPrice: total2,
          latitude: b.latitude ?? null,
          longitude: b.longitude ?? null,
          slug: b.slug ?? String(b.id),
        },
      });
    }
  }

  return pairs;
}
