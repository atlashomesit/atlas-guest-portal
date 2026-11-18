import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MultiRoomDrawer from './MultiRoomDrawer';

describe('MultiRoomDrawer (CLU-038)', () => {
  it('enforces max rooms cap and triggers onBookTogether when 2+ rooms are selected', () => {
    const onToggleRoom = vi.fn();
    const onBookTogether = vi.fn();
    const roomB = { listingId: 102, name: 'Garden Suite', maxGuests: 2, nightlyRate: 3000, totalStayAmount: 6000 };
    const roomC = { listingId: 103, name: 'Pool Room', maxGuests: 2, nightlyRate: 3500, totalStayAmount: 7000 };

    render(
      <MultiRoomDrawer
        open
        onClose={vi.fn()}
        anchorListingName="Master Suite"
        anchorGuests={2}
        anchorTotal={8000}
        loading={false}
        options={{
          enabled: true,
          maxRoomsPerBooking: 2,
          propertyId: 5,
          propertyName: 'Sunset Villa',
          currency: 'INR',
          rooms: [roomB, roomC],
        }}
        selectedExtraRooms={[roomB]}
        onToggleRoom={onToggleRoom}
        onBookTogether={onBookTogether}
      />,
    );

    expect(screen.getByTestId('multi-room-summary-count').textContent).toContain('2 rooms');
    expect((screen.getByTestId('multi-room-add-103') as HTMLButtonElement).disabled).toBe(true);

    const bookBtn = screen.getByTestId('multi-room-book-together') as HTMLButtonElement;
    expect(bookBtn.disabled).toBe(false);
    fireEvent.click(bookBtn);
    expect(onBookTogether).toHaveBeenCalledTimes(1);
  });
});
