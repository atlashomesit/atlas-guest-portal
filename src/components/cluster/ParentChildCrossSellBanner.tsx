import React from 'react';

export interface ChildRoomPreview {
  id: string | number;
  name: string;
  price?: number;
  available?: boolean;
}

export interface ParentChildCrossSellBannerProps {
  isParentCluster?: boolean;
  isUnavailable?: boolean;
  parentName?: string;
  childRooms?: ChildRoomPreview[];
  onSelectChildRoom?: (room: ChildRoomPreview) => void;
  onBrowseRooms?: () => void;
  className?: string;
}

export function isParentListing(listing: {
  isParentCluster?: boolean;
  clusterRole?: string | null;
  accommodationType?: string | null;
  propertyType?: string | null;
  name?: string | null;
}): boolean {
  if (listing.isParentCluster) return true;
  const role = (listing.clusterRole || '').toUpperCase();
  if (role === 'PARENT') return true;
  const acc = (listing.accommodationType || '').toLowerCase();
  if (acc === 'clusterparent' || acc === 'whole_villa_parent') return true;
  const n = (listing.name || '').toLowerCase();
  return /\b(whole villa|entire villa|estate parent)\b/i.test(n);
}

export const ParentChildCrossSellBanner: React.FC<ParentChildCrossSellBannerProps> = ({
  isParentCluster = true,
  isUnavailable = true,
  parentName,
  childRooms = [],
  onSelectChildRoom,
  onBrowseRooms,
  className = '',
}) => {
  if (!isParentCluster || !isUnavailable) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border-2 border-indigo-200 bg-indigo-50/80 p-4 text-indigo-950 shadow-sm space-y-3 ${className}`}
      data-testid="cluster-parent-child-cross-sell"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0" aria-hidden="true">
          🏡
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-indigo-900 leading-snug">
            Entire villa is unavailable on these dates because 1 room is booked — but individual private rooms are still available!
          </h4>
          <p className="text-xs text-indigo-800 leading-relaxed">
            {parentName ? `${parentName} is` : 'This property is'} sold both as a whole villa and as separate private suites. Even though the full buyout is reserved, you can still book private rooms for your dates.
          </p>
        </div>
      </div>

      {childRooms.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-indigo-900 mb-2">Available Individual Suites:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {childRooms.map((room) => (
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
                </div>
                {onSelectChildRoom && (
                  <button
                    type="button"
                    onClick={() => onSelectChildRoom(room)}
                    data-testid={`select-child-room-${room.id}`}
                    className="flex-shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    View Room
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60">
        <span className="text-xs text-indigo-700 font-medium">
          Cluster Lock-Off Protection · Zero Double Bookings
        </span>
        {onBrowseRooms && (
          <button
            type="button"
            onClick={onBrowseRooms}
            data-testid="view-child-rooms-btn"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
          >
            <span>Browse Available Private Rooms</span>
            <span>→</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ParentChildCrossSellBanner;
