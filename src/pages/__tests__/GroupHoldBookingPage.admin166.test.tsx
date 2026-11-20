import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupHoldBookingPage from '../GroupHoldBookingPage';
import { settle } from '../../test/settle';

describe('GroupHoldBookingPage (ADMIN-166)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders held rooms with server group prices and claims a room into /booking/:bookingId', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/public/group-links/tok123') && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            groupId: 7,
            groupName: 'Mehta Family Wedding',
            propertyName: 'Udaipur Heritage Haveli',
            hostWhatsappPhone: '+919876543210',
            checkIn: '2026-12-20',
            checkOut: '2026-12-22',
            nights: 2,
            discountPercent: 10,
            ended: false,
            allBooked: false,
            roomsLeft: 2,
            rooms: [
              { memberId: 11, listingId: 101, listingName: 'Lakeview Suite 101', maxGuests: 2, amountInr: 7200, currency: 'INR' },
              { memberId: 12, listingId: 102, listingName: 'Courtyard Room 102', maxGuests: 3, amountInr: 5400, currency: 'INR' },
            ],
          }),
        };
      }
      if (url.endsWith('/api/public/group-links/tok123/rooms/12/claim') && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            bookingId: 555,
            orderId: 'order_grp_7_12_abc',
            amountInr: 5400,
            amountPaise: 540000,
            currency: 'INR',
            claimedUntilUtc: '2026-12-19T12:15:00Z',
          }),
        };
      }
      return { ok: false, status: 404 };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter initialEntries={['/group/tok123']}>
        <Routes>
          <Route path="/group/:token" element={<GroupHoldBookingPage />} />
          <Route path="/booking/:bookingId" element={<div data-testid="booking-dest">Reached booking 555</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('Mehta Family Wedding')).toBeInTheDocument();
    expect(screen.getByTestId('group-room-card-11')).toHaveTextContent('Lakeview Suite 101');
    expect(screen.getByTestId('group-room-card-12')).toHaveTextContent('Courtyard Room 102');

    // Pick Courtyard Room 102
    fireEvent.click(screen.getByTestId('group-room-card-12'));
    fireEvent.change(screen.getByTestId('group-claim-name'), { target: { value: 'Rohan Mehta' } });
    fireEvent.change(screen.getByTestId('group-claim-phone'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByTestId('group-claim-submit'));

    await settle();
    expect(screen.getByTestId('booking-dest')).toHaveTextContent('Reached booking 555');
  });

  it('shows "Someone just booked this room. Pick another" on 409 room conflict', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/public/group-links/tok409') && (!init || !init.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            groupId: 8,
            groupName: 'Coorg Reunion',
            checkIn: '2026-12-24',
            checkOut: '2026-12-26',
            nights: 2,
            ended: false,
            allBooked: false,
            roomsLeft: 1,
            rooms: [
              { memberId: 21, listingId: 201, listingName: 'Estate Cottage 1', maxGuests: 2, amountInr: 6000, currency: 'INR' },
            ],
          }),
        };
      }
      if (url.endsWith('/api/public/group-links/tok409/rooms/21/claim')) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ code: 'GROUP_ROOM_ALREADY_CLAIMED', error: 'Someone just booked this room. Pick another' }),
        };
      }
      return { ok: false, status: 404 };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter initialEntries={['/group/tok409']}>
        <Routes>
          <Route path="/group/:token" element={<GroupHoldBookingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByText('Coorg Reunion')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('group-claim-name'), { target: { value: 'Priya Nair' } });
    fireEvent.change(screen.getByTestId('group-claim-phone'), { target: { value: '9123456789' } });
    fireEvent.click(screen.getByTestId('group-claim-submit'));

    await settle();
    expect(screen.getByTestId('group-hold-error')).toHaveTextContent(
      'Someone just booked this room. Pick another',
    );
  });

  it('shows "All rooms in this group are booked" when allBooked is true and "This group link has ended" when ended is true', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          groupId: 9,
          groupName: 'Full Group',
          checkIn: '2026-12-24',
          checkOut: '2026-12-26',
          nights: 2,
          ended: false,
          allBooked: true,
          roomsLeft: 0,
          rooms: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          groupId: 10,
          groupName: 'Expired Group',
          checkIn: '2026-12-24',
          checkOut: '2026-12-26',
          nights: 2,
          ended: true,
          allBooked: false,
          roomsLeft: 0,
          rooms: [],
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { unmount } = render(
      <MemoryRouter initialEntries={['/group/full']}>
        <Routes>
          <Route path="/group/:token" element={<GroupHoldBookingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByTestId('group-hold-all-booked')).toHaveTextContent(
      'All rooms in this group are booked',
    );
    unmount();

    render(
      <MemoryRouter initialEntries={['/group/expired']}>
        <Routes>
          <Route path="/group/:token" element={<GroupHoldBookingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await settle();
    expect(screen.getByTestId('group-hold-ended')).toHaveTextContent(
      'This group link has ended',
    );
  });
});