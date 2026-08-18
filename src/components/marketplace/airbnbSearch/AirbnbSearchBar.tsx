import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format, startOfMonth } from 'date-fns';
import { Search, X } from 'lucide-react';

// CALENDAR basis throughout — see the header comment in utils/date.ts and the matching note in
// SearchAvailabilityWidget. Cells from AtlasDateRangePicker are local-midnight civil dates;
// instants (now, URL params) are converted at the boundary with getIstCalendarDate.
import { getIstCalendarDate, startOfCalendarDay, toCalendarISO } from '@/utils/date';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import type { GuestCounts } from '@/components/ui/GuestTypeSelector';
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';
import { AirbnbGuestSelector } from './AirbnbGuestSelector';
import { filterDestinations } from './destinationData';
import { clearRecentSearches, persistRecentSearch, readRecentSearches } from './recentSearches';
import type { AirbnbSearchValues } from './types';

const MAX_GUESTS = 20;
const DEBOUNCE_MS = 300;

// BOUNDARY: `?checkIn=YYYY-MM-DD` parses as a UTC-midnight INSTANT, so it needs converting to
// the calendar basis rather than re-reading in the guest's local zone.
function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return getIstCalendarDate(instant);
}

function formatGuestSummary(counts: GuestCounts): string {
  const total = counts.adults + counts.children;
  const parts: string[] = [];
  if (counts.adults > 0) parts.push(`${counts.adults} adult${counts.adults === 1 ? '' : 's'}`);
  if (counts.children > 0) parts.push(`${counts.children} child${counts.children === 1 ? '' : 'ren'}`);
  if (counts.infants > 0) parts.push(`${counts.infants} infant${counts.infants === 1 ? '' : 's'}`);
  if (counts.pets > 0) parts.push(`${counts.pets} pet${counts.pets === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'Add guests';
  if (parts.length === 1 && total <= 1) return '1 guest';
  if (parts.length === 1) return `${total} guests`;
  return parts.join(' • ');
}

function buildSearchParams(values: AirbnbSearchValues): URLSearchParams {
  const p = new URLSearchParams();
  p.set('destination', values.destination.trim());
  p.set('checkIn', values.checkIn);
  p.set('checkOut', values.checkOut);
  p.set('adults', String(values.guests.adults));
  p.set('children', String(values.guests.children));
  p.set('infants', String(values.guests.infants));
  p.set('pets', String(values.guests.pets));
  const total = values.guests.adults + values.guests.children;
  if (total > 0) p.set('guests', String(total));
  return p;
}

export default function AirbnbSearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // The property's civil today, on the calendar basis — see SearchAvailabilityWidget.
  const today = useMemo(() => getIstCalendarDate(), []);

  const [destination, setDestination] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ startDate: Date | null; endDate: Date | null }>({
    startDate: null,
    endDate: null,
  });
  const [guestCounts, setGuestCounts] = useState<GuestCounts>({
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
  });

  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isDestinationOpen, setIsDestinationOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isGuestsOpen, setIsGuestsOpen] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'checkin' | 'checkout' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentEpoch, setRecentEpoch] = useState(0);

  const destinationRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const whenRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const destinationErrorId = useId();
  const dateErrorId = useId();
  const destinationListId = useId();
  const calendarContentId = useId();
  const calendarLabelId = useId();

  const recentOptions = useMemo(() => {
    void recentEpoch;
    return readRecentSearches().map((r) => ({
      label: r.destination,
      region: 'Recent search',
      kind: 'recent' as const,
    }));
  }, [recentEpoch]);

  const filteredDestinations = useMemo(
    () => filterDestinations(destinationQuery, recentOptions),
    [destinationQuery, recentOptions],
  );

  // URL prefill
  useEffect(() => {
    const dest = searchParams.get('destination') ?? searchParams.get('city') ?? '';
    const checkIn = searchParams.get('checkIn') ?? searchParams.get('checkin');
    const checkOut = searchParams.get('checkOut') ?? searchParams.get('checkout');
    const adults = Number(searchParams.get('adults')) || 2;
    const children = Number(searchParams.get('children')) || 0;
    const infants = Number(searchParams.get('infants')) || 0;
    const pets = Number(searchParams.get('pets')) || 0;

    if (dest) {
      setDestination(dest);
      setDestinationQuery(dest);
    }
    const start = parseIsoDate(checkIn);
    const end = parseIsoDate(checkOut);
    if (start || end) {
      setDateRange({ startDate: start, endDate: end });
    }
    setGuestCounts({ adults: Math.max(1, adults), children, infants, pets });
  }, [searchParams]);

  const closeAllPanels = useCallback(() => {
    setIsDestinationOpen(false);
    setIsCalendarOpen(false);
    setIsGuestsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (destinationRef.current?.contains(t)) return;
      if (whenRef.current?.contains(t)) return;
      setIsDestinationOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleDestinationInput = (value: string) => {
    setDestinationQuery(value);
    setDestination(value);
    setDestinationError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsDestinationOpen(true);
      setHighlightedIndex(-1);
    }, DEBOUNCE_MS);
  };

  const selectDestination = (label: string) => {
    setDestination(label);
    setDestinationQuery(label);
    setDestinationError(null);
    setIsDestinationOpen(false);
    setHighlightedIndex(-1);
  };

  const handleRangeChange = (selection: AtlasDateRangePickerValue) => {
    const start = selection.startDate ? startOfCalendarDay(selection.startDate) : null;
    const end = selection.endDate ? startOfCalendarDay(selection.endDate) : null;
    if (start && start < today) {
      setDateError('Please select valid travel dates.');
      return;
    }
    if (start && end && end <= start) {
      setDateError('Please select valid travel dates.');
      setDateRange({ startDate: start, endDate: null });
      return;
    }
    setDateError(null);
    setDateRange({ startDate: start, endDate: end });
    if (start && end && end > start) {
      setIsCalendarOpen(false);
      setActiveDateField(null);
    }
  };

  const validate = (): AirbnbSearchValues | null => {
    let ok = true;
    if (!destination.trim()) {
      setDestinationError('Please select a destination.');
      ok = false;
    }
    if (!dateRange.startDate || !dateRange.endDate || dateRange.endDate <= dateRange.startDate) {
      setDateError('Please select valid travel dates.');
      ok = false;
    }
    if (guestCounts.adults < 1) {
      ok = false;
    }
    if (!ok) return null;

    return {
      destination: destination.trim(),
      checkIn: toCalendarISO(dateRange.startDate!),
      checkOut: toCalendarISO(dateRange.endDate!),
      guests: guestCounts,
    };
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    closeAllPanels();
    const values = validate();
    if (!values) return;
    persistRecentSearch(values);
    setRecentEpoch((n) => n + 1);
    // TASK-4413: On marketplace homepage, filter grid in-place; otherwise redirect to /search
    if (location.pathname === '/') {
      const p = new URLSearchParams();
      p.set('city', values.destination.trim());
      p.set('checkIn', values.checkIn);
      p.set('checkOut', values.checkOut);
      const guestTotal = values.guests.adults + values.guests.children;
      if (guestTotal > 0) p.set('guests', String(guestTotal));
      navigate({ pathname: '/', search: p.toString() });
    } else {
      navigate({ pathname: '/search', search: buildSearchParams(values).toString() });
    }
  };

  const handleClearAll = () => {
    setDestination('');
    setDestinationQuery('');
    setDateRange({ startDate: null, endDate: null });
    setGuestCounts({ adults: 2, children: 0, infants: 0, pets: 0 });
    setDestinationError(null);
    setDateError(null);
    clearRecentSearches();
    setRecentEpoch((n) => n + 1);
    closeAllPanels();
  };

  const onDestinationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDestinationOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsDestinationOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setIsDestinationOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredDestinations.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && highlightedIndex >= 0 && filteredDestinations[highlightedIndex]) {
      e.preventDefault();
      selectDestination(filteredDestinations[highlightedIndex].label);
    }
  };

  const whenLabel =
    dateRange.startDate && dateRange.endDate
      ? `${format(dateRange.startDate, 'dd MMM')} – ${format(dateRange.endDate, 'dd MMM')}`
      : 'Add dates';
  const nights =
    dateRange.startDate && dateRange.endDate
      ? calculateNights(dateRange.startDate, dateRange.endDate)
      : 0;

  return (
    <form
      onSubmit={handleSearch}
      className="mx-auto w-full max-w-[1200px]"
      data-testid="airbnb-search-bar"
      noValidate
    >
      <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.12)] md:flex-row md:items-stretch md:rounded-full">
        {/* Where */}
        <div
          ref={destinationRef}
          className="relative flex-1 border-b border-border px-6 py-4 md:border-b-0 md:border-r"
        >
          <label htmlFor="airbnb-search-destination" className="block text-xs font-semibold text-text-primary">
            Where
          </label>
          <input
            ref={destinationInputRef}
            id="airbnb-search-destination"
            type="text"
            role="combobox"
            aria-expanded={isDestinationOpen}
            aria-controls={destinationListId}
            aria-invalid={destinationError ? true : undefined}
            aria-describedby={destinationError ? destinationErrorId : undefined}
            autoComplete="off"
            placeholder="Search destinations"
            value={destinationQuery}
            onChange={(e) => handleDestinationInput(e.target.value)}
            onFocus={() => setIsDestinationOpen(true)}
            onKeyDown={onDestinationKeyDown}
            className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-text-body placeholder:text-text-muted focus:outline-none focus:ring-0"
            data-testid="airbnb-search-destination"
          />
          {destinationError && (
            <p id={destinationErrorId} className="mt-1 text-xs text-red-600" role="alert">
              {destinationError}
            </p>
          )}
          {isDestinationOpen && (
            <ul
              id={destinationListId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-auto rounded-2xl border border-border bg-bg-surface py-2 shadow-lg"
            >
              {filteredDestinations.length === 0 ? (
                <li className="px-4 py-3 text-sm text-text-muted">No destinations found</li>
              ) : (
                filteredDestinations.map((item, index) => (
                  <li key={`${item.kind}-${item.label}`} role="option" aria-selected={highlightedIndex === index}>
                    <button
                      type="button"
                      className={`flex w-full flex-col px-4 py-3 text-left hover:bg-bg-muted ${
                        highlightedIndex === index ? 'bg-bg-muted' : ''
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectDestination(item.label)}
                    >
                      <span className="text-sm font-medium text-text-primary">{item.label}</span>
                      <span className="text-xs text-text-muted">{item.region}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {/* When */}
        <div
          ref={whenRef}
          className="relative flex-1 border-b border-border px-6 py-4 md:border-b-0 md:border-r"
        >
          <span className="block text-xs font-semibold text-text-primary">When</span>
          <button
            type="button"
            aria-expanded={isCalendarOpen}
            aria-controls={calendarContentId}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? dateErrorId : undefined}
            onClick={() => {
              setIsCalendarOpen((v) => !v);
              setIsGuestsOpen(false);
              setIsDestinationOpen(false);
            }}
            className="mt-1 w-full text-left text-sm text-text-body"
            data-testid="airbnb-search-when"
          >
            {whenLabel}
          </button>
          {nights > 0 && (
            <p className="mt-1 text-xs font-medium text-[var(--accent-text)]">{formatNightCount(nights)}</p>
          )}
          {dateError && (
            <p id={dateErrorId} className="mt-1 text-xs text-red-600" role="alert">
              {dateError}
            </p>
          )}
          <AtlasDateRangePicker
            anchorRef={whenRef}
            calendarRef={calendarRef}
            contentId={calendarContentId}
            labelId={calendarLabelId}
            heading="When is your trip?"
            loadingLabel="Loading calendar…"
            open={isCalendarOpen}
            onClose={() => {
              setIsCalendarOpen(false);
              setActiveDateField(null);
            }}
            value={dateRange}
            onChange={handleRangeChange}
            minDate={today}
            disabledDay={(date) => startOfCalendarDay(date) < today}
            months={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2}
            shownDate={dateRange.startDate ?? today}
            onShownDateChange={(d) => setDateRange((r) => ({ ...r, startDate: r.startDate ?? startOfMonth(d) }))}
            activeField={activeDateField}
          />
        </div>

        {/* Who */}
        <div className="relative flex flex-1 items-center gap-3 px-6 py-4 md:pr-2">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-text-primary">Who</span>
            <AirbnbGuestSelector
              value={guestCounts}
              onChange={setGuestCounts}
              maxCapacity={MAX_GUESTS}
              isOpen={isGuestsOpen}
              onToggle={() => {
                setIsGuestsOpen((v) => !v);
                setIsCalendarOpen(false);
                setIsDestinationOpen(false);
              }}
              onClose={() => setIsGuestsOpen(false)}
              summary={formatGuestSummary(guestCounts)}
            />
          </div>

          <button
            type="submit"
            aria-label="Search"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--cta-primary,#222)] text-[var(--text-on-cta,#fff)] shadow-md transition hover:scale-105 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta-primary,#222)] md:h-14 md:w-14"
            data-testid="airbnb-search-submit"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary"
          data-testid="airbnb-search-clear"
        >
          <X className="h-4 w-4" aria-hidden />
          Clear all
        </button>
      </div>
    </form>
  );
}
