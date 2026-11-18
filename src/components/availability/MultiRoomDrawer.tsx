import React from 'react';
import type { MultiRoomOption, MultiRoomOptionsResponse } from '@/api/multiRoomClient';

interface MultiRoomDrawerProps {
  open: boolean;
  onClose: () => void;
  anchorListingName: string;
  anchorGuests: number;
  anchorTotal: number;
  options: MultiRoomOptionsResponse | null;
  loading: boolean;
  selectedExtraRooms: MultiRoomOption[];
  onToggleRoom: (room: MultiRoomOption) => void;
  onBookTogether: () => void;
  submitting?: boolean;
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export const MultiRoomDrawer: React.FC<MultiRoomDrawerProps> = ({
  open,
  onClose,
  anchorListingName,
  anchorGuests,
  anchorTotal,
  options,
  loading,
  selectedExtraRooms,
  onToggleRoom,
  onBookTogether,
  submitting = false,
}) => {
  if (!open) return null;

  const maxRooms = options?.maxRoomsPerBooking ?? 4;
  const selectedCount = 1 + selectedExtraRooms.length;
  const atLimit = selectedCount >= maxRooms;
  const combinedTotal = anchorTotal + selectedExtraRooms.reduce((sum, r) => sum + r.totalStayAmount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add another room"
      data-testid="multi-room-drawer"
    >
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-bg-surface border border-border-subtle shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Add another room</h3>
            <p className="text-xs text-text-secondary">
              Combine up to {maxRooms} open rooms at {options?.propertyName || 'this property'} in one checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-muted"
            aria-label="Close"
            data-testid="multi-room-close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="rounded-xl border border-brand-primary/40 bg-brand-primary/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">{anchorListingName}</p>
              <p className="text-xs text-text-secondary">Primary room · {anchorGuests} guest{anchorGuests === 1 ? '' : 's'}</p>
            </div>
            <span className="text-sm font-semibold text-text-primary">{formatInr(anchorTotal)}</span>
          </div>

          {loading ? (
            <p className="text-sm text-text-secondary py-4 text-center">Checking other open rooms…</p>
          ) : !options || options.rooms.length === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center" data-testid="multi-room-empty">
              No other rooms are available for these dates.
            </p>
          ) : (
            <div className="space-y-2">
              {options.rooms.map((room) => {
                const isSelected = selectedExtraRooms.some((r) => r.listingId === room.listingId);
                const disabled = !isSelected && atLimit;
                return (
                  <div
                    key={room.listingId}
                    className="rounded-xl border border-border-subtle p-3 flex items-center justify-between gap-3"
                    data-testid={`multi-room-option-${room.listingId}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{room.name}</p>
                      <p className="text-xs text-text-secondary">
                        Up to {room.maxGuests} guest{room.maxGuests === 1 ? '' : 's'} · {formatInr(room.totalStayAmount)} total
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleRoom(room)}
                      data-testid={`multi-room-add-${room.listingId}`}
                      className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : disabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border border-brand-primary text-brand-primary hover:bg-brand-primary/5'
                      }`}
                    >
                      {isSelected ? 'Added ✓' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border-subtle bg-bg-muted flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold text-text-primary" data-testid="multi-room-summary-count">
              {selectedCount} {selectedCount === 1 ? 'room' : 'rooms'} · {formatInr(combinedTotal)}
            </div>
            <div className="text-xs text-text-secondary">
              {selectedCount < 2 ? 'Add at least 1 more room to book together' : 'One payment, separate room confirmations'}
            </div>
          </div>
          <button
            type="button"
            disabled={selectedCount < 2 || submitting}
            onClick={onBookTogether}
            data-testid="multi-room-book-together"
            className="min-h-[44px] px-4 rounded-xl bg-brand-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Reserving…' : 'Book these rooms together'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiRoomDrawer;
