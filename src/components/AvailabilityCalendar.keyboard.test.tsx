import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import AvailabilityCalendar from './AvailabilityCalendar';
import { settle } from '../test/settle';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), booking: {} as Record<string, unknown> }));
vi.mock('@/api/client', () => ({ buildApiUrl: (path: string) => `http://localhost:5120${path}`, getApiHeaders: () => ({}) }));
vi.mock('@/api/availabilityCalendarClient', () => ({ dedupedAvailabilityCalendarFetch: (...args: unknown[]) => mocks.fetch(...args) }));
vi.mock('@/contexts/BookingContext', () => ({ useBooking: () => ({ booking: mocks.booking, updateBooking: vi.fn() }) }));

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const dateCell = (day: number, month = 'September') => screen.getByRole('gridcell', { name: new RegExp(`\\b${day} ${month} 2026`) });

describe('GUEST-011 listing calendar keyboard navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 12));
    mocks.booking = {};
    mocks.fetch.mockReset().mockResolvedValue(response([]));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('has named Monday-first grids and one tab stop without stealing focus after load', async () => {
    const select = vi.fn();
    render(<><button>Before calendar</button><AvailabilityCalendar listingId={7} onDateSelect={select} /><button>After calendar</button></>);
    const before = screen.getByRole('button', { name: 'Before calendar' });
    before.focus();
    await settle();
    const grid = screen.getByRole('grid', { name: 'September 2026 availability' });
    await settle();
    expect(dateCell(28)).toHaveAttribute('tabindex', '0');
    expect(before).toHaveFocus();
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    expect(within(grid).getAllByRole('columnheader')[0]).toHaveAccessibleName('Monday');
    expect(document.querySelectorAll('[data-calendar-date][tabindex="0"]')).toHaveLength(1);
    expect(dateCell(28).tagName).toBe('BUTTON');
    expect(dateCell(28)).toHaveAccessibleName('Monday, 28 September 2026: Available for check-in');
    expect(dateCell(27)).toBeDisabled();
  });

  it('moves across months, skips unavailable dates and selects turnover with Enter/Space exactly once', async () => {
    mocks.fetch.mockResolvedValue(response([
      { date: '2026-09-29', status: 'blocked' },
      { date: '2026-09-30', status: 'booked' },
      { date: '2026-10-01', status: 'hold' },
      { date: '2026-10-02', status: 'turnover' },
    ]));
    const select = vi.fn();
    render(<AvailabilityCalendar listingId={7} onDateSelect={select} />);
    await settle();
    expect(dateCell(28)).toBeEnabled();
    dateCell(28).focus();
    fireEvent.keyDown(dateCell(28), { key: 'ArrowRight' });
    expect(dateCell(2, 'October')).toHaveFocus();
    expect(dateCell(2, 'October')).toHaveAttribute('tabindex', '0');
    expect(dateCell(2, 'October')).toHaveAccessibleName('Friday, 2 October 2026: Turnover, check-in allowed');
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(dateCell(2, 'October'), { key: 'Enter' });
    expect(select).toHaveBeenNthCalledWith(1, '2026-10-02');
    fireEvent.keyDown(dateCell(2, 'October'), { key: ' ' });
    expect(select).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(dateCell(2, 'October'), { key: 'ArrowLeft' });
    expect(dateCell(28)).toHaveFocus();
  });

  it('uses Monday/Sunday week boundaries and seven-day navigation, clamped to the displayed months', async () => {
    render(<AvailabilityCalendar listingId={7} onDateSelect={vi.fn()} />);
    await settle();
    expect(dateCell(28)).toBeEnabled();
    dateCell(28).focus();
    fireEvent.keyDown(dateCell(28), { key: 'ArrowDown' });
    expect(dateCell(5, 'October')).toHaveFocus();
    fireEvent.keyDown(dateCell(5, 'October'), { key: 'End' });
    expect(dateCell(11, 'October')).toHaveFocus();
    fireEvent.keyDown(dateCell(11, 'October'), { key: 'Home' });
    expect(dateCell(5, 'October')).toHaveFocus();
    fireEvent.keyDown(dateCell(5, 'October'), { key: 'ArrowUp' });
    expect(dateCell(28)).toHaveFocus();
    fireEvent.keyDown(dateCell(28), { key: 'ArrowLeft' });
    expect(dateCell(28)).toHaveFocus();
    dateCell(31, 'October').focus();
    fireEvent.keyDown(dateCell(31, 'October'), { key: 'ArrowRight' });
    expect(dateCell(31, 'October')).toHaveFocus();
  });

  it('keeps every date non-interactive during loading and payment holds', async () => {
    let resolve!: (r: Response) => void;
    mocks.fetch.mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    const select = vi.fn();
    const view = render(<AvailabilityCalendar listingId={7} onDateSelect={select} />);
    expect(dateCell(28)).toBeDisabled();
    expect(document.querySelectorAll('[data-calendar-date][tabindex="0"]')).toHaveLength(0);
    resolve(response([]));
    await settle();
    expect(dateCell(28)).toBeEnabled();
    mocks.booking = { paymentHoldBookingId: 42, paymentHoldToken: 'synthetic', holdExpiresAt: new Date(Date.now() + 900_000).toISOString() };
    view.rerender(<AvailabilityCalendar listingId={7} onDateSelect={select} />);
    expect(dateCell(28)).toBeDisabled();
    expect(dateCell(28)).toHaveAccessibleName(/Dates locked while payment completes/);
    fireEvent.keyDown(dateCell(28), { key: 'Enter' });
    expect(select).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-calendar-date][tabindex="0"]')).toHaveLength(0);
  });

  it('does not expose selectable dates after a malformed availability response', async () => {
    mocks.fetch.mockResolvedValue(response({ unexpected: 'not a calendar' }));
    render(<AvailabilityCalendar listingId={7} onDateSelect={vi.fn()} />);
    await settle();
    screen.getByTestId('availability-calendar-error');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
