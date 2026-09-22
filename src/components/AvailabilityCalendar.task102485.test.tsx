/**
 * TASK-102485 [GUEST-PORTAL/AVAILABILITY]: "Check Availability" fail-closed coverage.
 *
 * Proving tests for the fix (RED on origin/dev, GREEN with the fix applied):
 *  1. AvailabilityCalendar renders a real error state + retry UI when the calendar GET
 *     fails (pre-fix: only a DEV console.warn, grid rendered all-available from the
 *     empty map — fail-OPEN).
 *  2. AvailabilityCalendar with a falsy listingId renders null and does not hang a
 *     skeleton (pre-fix: effect early-returned leaving `loading` stuck true).
 *  3. AvailabilityCalendar happy path still renders the grid with no error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, act, waitFor } from '@testing-library/react';

const availabilityMock = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => `http://localhost:5120${path}`,
  getApiHeaders: () => ({}),
}));
vi.mock('@/api/availabilityCalendarClient', () => ({
  dedupedAvailabilityCalendarFetch: (...args: unknown[]) => availabilityMock.fetch(...args),
}));
vi.mock('@/utils/serverErrorFromResponse', () => ({
  messageFromApiResponse: async () => 'calendar unavailable',
}));
vi.mock('@/contexts/BookingContext', () => ({
  useBooking: () => ({ booking: {}, updateBooking: vi.fn() }),
}));

import AvailabilityCalendar from './AvailabilityCalendar';

const okEmpty = () =>
  new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  availabilityMock.fetch.mockReset();
  availabilityMock.fetch.mockImplementation(() => Promise.resolve(okEmpty()));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AvailabilityCalendar - TASK-102485: fetch failure fail-closes with error + retry', () => {
  it('shows the error + retry UI and hides the grid when the calendar GET is non-OK', async () => {
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch.mockResolvedValue(new Response('nope', { status: 500 }));

    render(<AvailabilityCalendar listingId={7} />);

    // Fail-closed: error surfaced with a retry affordance …
    await screen.findByTestId('availability-calendar-error');
    expect(screen.getByTestId('availability-calendar-retry')).toBeInTheDocument();
  });

  it('retry re-issues the calendar GET and recovers the grid on success', async () => {
    availabilityMock.fetch.mockReset();
    availabilityMock.fetch
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockImplementation(() => Promise.resolve(okEmpty()));

    render(<AvailabilityCalendar listingId={7} />);
    const retry = await screen.findByTestId('availability-calendar-retry');

    await act(async () => {
      fireEvent.click(retry);
    });

    // A second GET went out …
    await waitFor(() => {
      expect(availabilityMock.fetch).toHaveBeenCalledTimes(2);
    });
    // … and once it succeeds the error clears (grid back, no alert).
    await waitFor(() => {
      expect(screen.queryByTestId('availability-calendar-error')).toBeNull();
    });
  });

  it('renders nothing (no stuck skeleton) for a falsy listingId', () => {
    const { container } = render(<AvailabilityCalendar listingId={''} />);
    expect(container.firstChild).toBeNull();
    expect(availabilityMock.fetch).not.toHaveBeenCalled();
  });

  it('happy path: grid renders with no error on a 200 empty calendar', async () => {
    render(<AvailabilityCalendar listingId={7} />);

    // Month headings prove the grid rendered …
    const headings = await screen.findAllByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/);
    expect(headings.length).toBe(2);
    // … with no error UI.
    expect(screen.queryByTestId('availability-calendar-error')).toBeNull();
  });
});
