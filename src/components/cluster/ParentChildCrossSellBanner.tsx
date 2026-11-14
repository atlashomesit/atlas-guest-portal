import React from 'react';
import type { ClusterChildrenAvailability } from '@/api/clusterChildrenClient';

export interface ChildRoomPreview {
  id: string | number;
  name: string;
  price?: number | null;
  maxGuests?: number | null;
  /** Child page with the searched dates prefilled. */
  href?: string;
}

export interface ParentChildCrossSellBannerProps {
  isParentCluster?: boolean;
  isUnavailable?: boolean;
  parentName?: string;
  /** CLU-011: the real cause + free Child rooms from the public cluster-children-availability read. */
  availability?: ClusterChildrenAvailability | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  /** Route segment of the Child page: `/homes/{propertySlug}/{listingId}`. */
  propertySlug?: string;
  onSelectChildRoom?: (room: ChildRoomPreview) => void;
  className?: string;
}

/** CLU-011: role/type come from the API payload only - never guessed from the listing name. */
// eslint-disable-next-line react-refresh/only-export-components -- co-located cluster helper
export function isParentListing(listing: {
  isParentCluster?: boolean;
  clusterRole?: string | null;
  accommodationType?: string | null;
}): boolean {
  if (listing.isParentCluster) return true;
  const role = (listing.clusterRole || '').toUpperCase();
  if (role === 'PARENT') return true;
  const acc = (listing.accommodationType || '').toLowerCase();
  return acc === 'clusterparent' || acc === 'whole_villa_parent';
}

/** `/homes/{propertySlug}/{childId}?checkIn=yyyy-MM-dd&checkOut=yyyy-MM-dd&guests=N` (params optional). */
// eslint-disable-next-line react-refresh/only-export-components -- co-located cluster helper
export function buildChildRoomHref(
  propertySlug: string | undefined,
  childId: number,
  checkIn?: string | null,
  checkOut?: string | null,
  guests?: number | null,
  maxGuests?: number | null,
): string {
  const base = `/homes/${propertySlug || 'atlas-homes'}/${childId}`;
  const params = new URLSearchParams();
  if (checkIn && checkOut) {
    params.set('checkIn', checkIn);
    params.set('checkOut', checkOut);
  }
  if (typeof guests === 'number' && Number.isFinite(guests) && guests > 0) {
    const clamped =
      typeof maxGuests === 'number' && Number.isFinite(maxGuests) && maxGuests > 0
        ? Math.min(Math.floor(guests), Math.floor(maxGuests))
        : Math.floor(guests);
    params.set('guests', String(clamped));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export const ParentChildCrossSellBanner: React.FC<ParentChildCrossSellBannerProps> = ({
  isParentCluster = true,
  isUnavailable = true,
  parentName,
  availability,
  checkIn,
  checkOut,
  guests,
  propertySlug,
  onSelectChildRoom,
  className = '',
}) => {
  // Only claim something about the rooms when the API says some Children are booked AND some are free.
  // Parent itself booked/blocked, nothing booked, or no free Child -> no cross-sell at all.
  if (!isParentCluster || !isUnavailable || !availability) return null;
  if (availability.cause !== 'ChildrenBooked' || availability.freeChildren.length === 0) return null;

  const booked = availability.unavailableChildren;
  const free = availability.freeChildren.length;
  const total = availability.totalChildren || booked + free;
  const rooms: ChildRoomPreview[] = availability.freeChildren.map((c) => ({
    id: c.listingId,
    name: c.name,
    price: c.nightlyRate,
    maxGuests: c.maxGuests ?? null,
    href: buildChildRoomHref(propertySlug, c.listingId, checkIn, checkOut, guests, c.maxGuests),
  }));

  const requestedGuests = typeof guests === 'number' && Number.isFinite(guests) ? Math.floor(guests) : 0;
  let combinationHint: string | null = null;
  if (requestedGuests > 2 && rooms.length >= 2) {
    const withCapacity = rooms.filter((r) => typeof r.maxGuests === 'number' && r.maxGuests > 0);
    const totalCap = withCapacity.reduce((acc, r) => acc + (r.maxGuests || 0), 0);
    if (totalCap >= requestedGuests) {
      const sorted = [...withCapacity].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      let cap = 0;
      let count = 0;
      let sumPrice = 0;
      let allPriced = true;
      for (const r of sorted) {
        cap += r.maxGuests || 0;
        count += 1;
        if (typeof r.price === 'number') {
          sumPrice += r.price;
        } else {
          allPriced = false;
        }
        if (cap >= requestedGuests) break;
      }
      if (count >= 2) {
        combinationHint = allPriced
          ? `Need space for ${requestedGuests} guests? Combine ${count} open rooms from ₹${sumPrice.toLocaleString('en-IN')}/night`
          : `Need space for ${requestedGuests} guests? Combine ${count} open rooms`;
      }
    }
  }

  return (
    <div
      className={`rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-4 text-indigo-950 shadow-sm space-y-3 ${className}`}
      data-testid="cluster-parent-child-cross-sell"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0" aria-hidden="true">
          🏡
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-indigo-900 leading-snug" data-testid="cluster-cross-sell-headline">
            The whole villa is taken because {booked} room{booked === 1 ? ' is' : 's are'} booked, but {free}{' '}
            {free === 1 ? 'is' : 'are'} free.
          </h4>
          <p className="text-xs text-indigo-800 leading-relaxed" data-testid="cluster-cross-sell-count">
            {free} of {total} rooms {free === 1 ? 'is' : 'are'} free on these dates
            {parentName ? ` at ${parentName}` : ''}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-200 bg-white/90 text-xs shadow-2xs"
            data-testid={`child-room-card-${room.id}`}
          >
            <div className="min-w-0 pr-2">
              <p className="font-semibold text-slate-800 truncate">{room.name}</p>
              {room.price != null && (
                <p className="text-indigo-700 font-medium">₹{room.price.toLocaleString('en-IN')}/night</p>
              )}
              {typeof room.maxGuests === 'number' && room.maxGuests > 0 && (
                <p className="text-slate-600">Up to {room.maxGuests} {room.maxGuests === 1 ? 'guest' : 'guests'}</p>
              )}
            </div>
            <a
              href={room.href}
              onClick={(e) => {
                if (onSelectChildRoom) {
                  e.preventDefault();
                  onSelectChildRoom(room);
                }
              }}
              data-testid={`select-child-room-${room.id}`}
              className="flex-shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
            >
              View {room.name}
            </a>
          </div>
        ))}
      </div>

      {combinationHint && (
        <p className="text-xs font-medium text-indigo-900" data-testid="cluster-cross-sell-combination">
          {combinationHint}
        </p>
      )}
    </div>
  );
};

export default ParentChildCrossSellBanner;
