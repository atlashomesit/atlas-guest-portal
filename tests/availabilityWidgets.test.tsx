import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { computeBlockedDates } from '@/be/availabilityCalendar';
import { SearchAvailabilityWidget, UnitBookingWidget } from '@/components/availability/AvailabilityWidget';

describe('availability calendar utilities', () => {
  it('generates unique future blocked dates only', () => {
    const today = new Date('2024-03-10T12:00:00Z');
    const blocked = computeBlockedDates(
      [
        { checkinDate: '2024-03-08', checkoutDate: '2024-03-12' },
        { checkinDate: '2024-03-11', checkoutDate: '2024-03-13' },
        { checkinDate: '2024-01-01', checkoutDate: '2024-01-03' },
      ],
      today,
    );

    expect(blocked.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2024-03-10',
      '2024-03-11',
      '2024-03-12',
    ]);
  });
});

describe('SearchAvailabilityWidget', () => {
  it('ignores booked-date fetches entirely', async () => {
    const fetchBookings = vi.fn();

    render(<SearchAvailabilityWidget fetchBookings={fetchBookings} />);

    await waitFor(() => {
      expect(fetchBookings).not.toHaveBeenCalled();
      expect(screen.getByTestId('blocked-date-list').children.length).toBe(0);
    });
  });

  it('throws if given a listingId', () => {
    expect(() => render(<SearchAvailabilityWidget listingId="123" />)).toThrow(
      'Search availability should not be provided a listingId.',
    );
  });
});

describe('UnitBookingWidget', () => {
  it('requires a listingId before calling the booking API', () => {
    expect(() => render(<UnitBookingWidget />)).toThrow('Unit availability requires a listingId.');
  });

  it('fetches bookings and renders blocked dates for a listing', async () => {
    const fetchBookings = vi.fn().mockResolvedValue([
      { checkinDate: '2024-04-01', checkoutDate: '2024-04-03' },
      { checkinDate: '2024-04-05', checkoutDate: '2024-04-06' },
    ]);

    render(<UnitBookingWidget fetchBookings={fetchBookings} listingId="A1" today={new Date('2024-04-01')} />);

    await waitFor(() => {
      expect(fetchBookings).toHaveBeenCalledWith('A1');
      expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        '2024-04-01',
        '2024-04-02',
        '2024-04-05',
      ]);
    });
  });
});
