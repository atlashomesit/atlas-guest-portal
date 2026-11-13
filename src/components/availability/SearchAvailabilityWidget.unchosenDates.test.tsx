import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { getIstCalendarDate, toCalendarISO } from '@/utils/date';

/**
 * TASK-10299460: the home page SHOWS today -> tomorrow in the search box when the guest chose
 * nothing, but it used to write that range into BookingContext on mount, which persists it to
 * localStorage as `atlasHeroSearch`. Every home that was booked tonight then opened as "Dates
 * unavailable / Pick different nights" for a guest who never asked for tonight.
 *
 * What these cases pin:
 *   1. an untouched home page writes NO dates to BookingContext or localStorage (but still shows
 *      today -> tomorrow in the box);
 *   2. dates the guest actually picks, the Check availability button, and dates that arrive on
 *      the URL still carry over;
 *   3. a search saved by the OLD code (no `datesChosen` marker) that is just the default range is
 *      not restored, while a real saved search still is.
 */

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

// The popover portals in production; render it inline so the calendar grid is queryable.
vi.mock('@/components/homepage_components/hotelBooking_form/DateRangePickerPopover', () => ({
  DateRangePickerPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="date-picker-popover">{children}</div> : null,
}));

import { SearchAvailabilityWidget } from '@/components/availability/SearchAvailabilityWidget';
import { BookingProvider, useBooking } from '@/contexts/BookingContext';
import { settle } from '../../test/settle';

// 12:00 UTC = 17:30 IST, so the IST civil date is the 15th in every runner zone.
const FIXED_NOW = new Date('2026-02-15T12:00:00Z');
const TODAY_ISO = '2026-02-15';
const TOMORROW_ISO = '2026-02-16';
const PICKED_ISO = '2026-02-20';
const CHECKOUT_ISO = '2026-02-23';
const STORAGE_KEY = 'atlasHeroSearch';

/** IST-midnight instant (the BookingContext wire format) of a civil date. */
const wire = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toISOString();
const wireToCivilDate = (value: string | null | undefined): string | null =>
  value ? toCalendarISO(getIstCalendarDate(new Date(value))) : null;

const Probe: React.FC = () => {
  const { booking } = useBooking();
  const location = useLocation();
  return (
    <>
      <span data-testid="probe-checkin">{booking.checkIn ?? ''}</span>
      <span data-testid="probe-checkout">{booking.checkOut ?? ''}</span>
      <span data-testid="probe-search">{location.search}</span>
    </>
  );
};

const savedSearch = () => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
};

describe('SearchAvailabilityWidget — default dates are display-only until the guest chooses', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const renderWidget = (entry = '/') =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <BookingProvider>
          <SearchAvailabilityWidget />
          <Probe />
        </BookingProvider>
      </MemoryRouter>,
    );

  const openCalendar = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-date-toggle'));
    });
    await settle();
    screen.getByTestId('date-picker-popover');
  };

  // react-date-range commits a selection on mousedown+mouseup, not click.
  const selectDay = async (iso: string) => {
    const cell = screen.getByTestId(`hero-date-${iso}`).closest('button');
    expect(cell).toBeTruthy();
    await act(async () => {
      fireEvent.mouseDown(cell!);
      fireEvent.mouseUp(cell!);
    });
  };

  // PROVING CASE 1 — red on the old code (it wrote today -> tomorrow on mount).
  it('an untouched home page still shows today in the box but writes no dates to BookingContext or localStorage', async () => {
    renderWidget();
    await settle();

    expect(screen.getByTestId('hero-date-toggle').textContent).toContain('15 Feb 2026');
    expect(screen.getByTestId('probe-checkin').textContent).toBe('');
    expect(screen.getByTestId('probe-checkout').textContent).toBe('');
    const saved = savedSearch();
    expect(saved).not.toBeNull();
    expect(saved!.checkIn).toBeNull();
    expect(saved!.checkOut).toBeNull();
  });

  it('changing only the guest count on an untouched home page still writes no dates', async () => {
    renderWidget();
    await settle();

    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-guest-toggle'));
    });
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Increase adults' }));
    });
    await settle();

    expect(screen.getByTestId('probe-checkin').textContent).toBe('');
    expect(screen.getByTestId('probe-checkout').textContent).toBe('');
  });

  it('dates the guest picks carry over to BookingContext and are persisted as chosen', async () => {
    renderWidget();
    await openCalendar();

    await selectDay(PICKED_ISO);
    await selectDay(CHECKOUT_ISO);
    await settle();

    expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(PICKED_ISO);
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(CHECKOUT_ISO);
    const saved = savedSearch();
    expect(wireToCivilDate(saved!.checkIn as string)).toBe(PICKED_ISO);
    expect(saved!.datesChosen).toBe(true);
  });

  it('the Tonight preset is a deliberate choice, so tonight carries over', async () => {
    renderWidget();
    await openCalendar();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tonight' }));
    });
    await settle();

    expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(TODAY_ISO);
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(TOMORROW_ISO);
  });

  // PROVING CASE 2 — Check availability on the untouched default is still a choice of those nights.
  it('pressing Check availability carries the shown dates to BookingContext and /search', async () => {
    renderWidget();
    await settle();
    expect(screen.getByTestId('probe-checkin').textContent).toBe('');

    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-search-submit'));
    });
    await settle();

    expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(TODAY_ISO);
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(TOMORROW_ISO);
    const search = screen.getByTestId('probe-search').textContent ?? '';
    expect(search).toContain(`checkIn=${TODAY_ISO}`);
    expect(search).toContain(`checkOut=${TOMORROW_ISO}`);
  });

  it('dates that arrive on the URL carry over to BookingContext', async () => {
    renderWidget(`/search?checkIn=${PICKED_ISO}&checkOut=${CHECKOUT_ISO}`);
    await settle();

    expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(PICKED_ISO);
    expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(CHECKOUT_ISO);
  });

  it('resetting the dates back to the default drops the saved ones', async () => {
    renderWidget();
    await openCalendar();
    await selectDay(PICKED_ISO);
    await selectDay(CHECKOUT_ISO);
    await settle();
    expect(screen.getByTestId('probe-checkin').textContent).not.toBe('');

    await act(async () => {
      fireEvent.click(screen.getByTestId('hero-search-clear-dates'));
    });
    await settle();

    expect(screen.getByTestId('probe-checkin').textContent).toBe('');
    expect(screen.getByTestId('probe-checkout').textContent).toBe('');
    expect(savedSearch()!.checkIn).toBeNull();
    // The box goes back to showing the display default.
    expect(screen.getByTestId('hero-date-toggle').textContent).toContain('15 Feb 2026');
  });

  describe('a search saved before the fix', () => {
    const seed = (value: Record<string, unknown>) =>
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ propertyId: null, propertyName: null, guests: 2, listingDetailPath: null, ...value }));

    // PROVING CASE 3 — red on the old code (it restored the saved default and rewrote it).
    it('the saved default range (tonight -> tomorrow, no marker) is not restored', async () => {
      seed({ checkIn: wire(TODAY_ISO), checkOut: wire(TOMORROW_ISO) });
      renderWidget();
      await settle();

      expect(screen.getByTestId('probe-checkin').textContent).toBe('');
      expect(screen.getByTestId('probe-checkout').textContent).toBe('');
      expect(savedSearch()!.checkIn).toBeNull();
    });

    it('a saved one-night range that is already in the past is not restored either', async () => {
      seed({ checkIn: wire('2026-02-12'), checkOut: wire('2026-02-13') });
      renderWidget();
      await settle();

      expect(screen.getByTestId('probe-checkin').textContent).toBe('');
    });

    it('a saved multi-night search starting in the future (no marker) still restores', async () => {
      seed({ checkIn: wire(PICKED_ISO), checkOut: wire(CHECKOUT_ISO) });
      renderWidget();
      await settle();

      expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(PICKED_ISO);
      expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(CHECKOUT_ISO);
    });

    it('a search saved by the fixed code (datesChosen) restores exactly, even for tonight', async () => {
      seed({ checkIn: wire(TODAY_ISO), checkOut: wire(TOMORROW_ISO), datesChosen: true });
      renderWidget();
      await settle();

      expect(wireToCivilDate(screen.getByTestId('probe-checkin').textContent)).toBe(TODAY_ISO);
      expect(wireToCivilDate(screen.getByTestId('probe-checkout').textContent)).toBe(TOMORROW_ISO);
    });
  });
});
