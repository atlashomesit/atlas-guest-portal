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
import { filterDestinations, POPULAR_DESTINATIONS } from './destinationData';
import { fetchPublicCities } from '@/api/publicCities';
import { clearRecentSearches, persistRecentSearch, readRecentSearches } from './recentSearches';
import type { AirbnbSearchValues, DestinationOption } from './types';
import { isMarketplaceMode } from '@/tenant/tenantResolver';
import {
  FLEX_LENGTH_OPTIONS,
  formatFlexSummary,
  getUpcomingFlexMonths,
  parseFlexDays,
  parseFlexLength,
  parseFlexMonths,
  type FlexLength,
} from '@/utils/flexibleSearch';

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

function buildSearchParams(
  values: AirbnbSearchValues,
  currentParams?: URLSearchParams,
): URLSearchParams {
  const p = new URLSearchParams();
  const brand = currentParams?.get('brand');
  if (brand?.trim().toLowerCase() === 'atlastays' || isMarketplaceMode()) {
    p.set('brand', brand?.trim() || 'atlastays');
  }
  p.set('destination', values.destination.trim());
  p.set('location', values.destination.trim());
  if (values.checkIn) p.set('checkIn', values.checkIn);
  if (values.checkOut) p.set('checkOut', values.checkOut);
  if (values.flexDays && values.flexDays > 0 && values.checkIn && values.checkOut) {
    p.set('flexDays', String(values.flexDays));
  }
  if (values.flexLength) {
    p.set('flexLength', values.flexLength);
    if (values.flexMonths && values.flexMonths.length > 0) {
      p.set('flexMonths', values.flexMonths.join(','));
    }
  }
  p.set('adults', String(values.guests.adults));
  p.set('children', String(values.guests.children));
  p.set('infants', String(values.guests.infants));
  p.set('pets', String(values.guests.pets));
  const total = values.guests.adults + values.guests.children;
  if (total > 0) p.set('guests', String(total));
  return p;
}

type AirbnbSearchBarProps = {
  /** In-flow marketplace panels must not move a pointer target before its click. */
  preserveFlowPointerTargets?: boolean;
  /** MKT-056: collapse the 3-row mobile form into a single compact pill until tapped. */
  compactMobile?: boolean;
};

export default function AirbnbSearchBar({
  preserveFlowPointerTargets = false,
  compactMobile = false,
}: AirbnbSearchBarProps) {
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
  const [dateMode, setDateMode] = useState<'dates' | 'flexible'>('dates');
  const [flexDays, setFlexDays] = useState<number>(0);
  const [flexLength, setFlexLength] = useState<FlexLength>('weekend');
  const [flexMonths, setFlexMonths] = useState<string[]>([]);
  const upcomingMonths = useMemo(() => getUpcomingFlexMonths(today, 6), [today]);
  // GUEST-036: the month the calendar is paging through is view state, kept apart from the stay
  // dates. It used to be written into dateRange.startDate, which planted a phantom check-in on
  // every month change and snapped the grid forward again.
  const [shownDate, setShownDate] = useState<Date>(today);
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
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'checkin' | 'checkout' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentEpoch, setRecentEpoch] = useState(0);

  const destinationRef = useRef<HTMLDivElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const whenRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDestination = useCallback(() => {
    if (preserveFlowPointerTargets && debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setIsDestinationOpen(false);
  }, [preserveFlowPointerTargets]);

  useEffect(() => () => {
    if (preserveFlowPointerTargets && debounceRef.current) clearTimeout(debounceRef.current);
  }, [preserveFlowPointerTargets]);

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

  const [livePool, setLivePool] = useState<DestinationOption[]>(POPULAR_DESTINATIONS);
  useEffect(() => {
    const ac = new AbortController();
    fetchPublicCities(ac.signal)
      .then((cities) => { if (cities.length > 0) setLivePool(cities); })
      .catch(() => {/* offline or 4xx: keep POPULAR_DESTINATIONS fallback */});
    return () => ac.abort();
  }, []);

  const filteredDestinations = useMemo(
    () => filterDestinations(destinationQuery, recentOptions, livePool),
    [destinationQuery, recentOptions, livePool],
  );

  // URL prefill — restores the bar when arriving with search criteria in the URL
  // (Back-navigation from property details, shared links). TASK-102058: the `/`
  // homepage search writes only the `guests` TOTAL, never adults/children, so the
  // total must hydrate Who — otherwise Back-navigation silently resets guests to 2.
  useEffect(() => {
    const dest = searchParams.get('destination') ?? searchParams.get('city') ?? '';
    const checkIn = searchParams.get('checkIn') ?? searchParams.get('checkin');
    const checkOut = searchParams.get('checkOut') ?? searchParams.get('checkout');
    const adultsRaw = searchParams.get('adults');
    const childrenRaw = searchParams.get('children');
    const infantsRaw = searchParams.get('infants');
    const petsRaw = searchParams.get('pets');
    const guestsRaw = searchParams.get('guests');

    if (dest) {
      setDestination(dest);
      setDestinationQuery(dest);
    }
    const start = parseIsoDate(checkIn);
    const end = parseIsoDate(checkOut);
    const urlFlexDays = parseFlexDays(searchParams.get('flexDays'));
    const urlFlexLength = parseFlexLength(searchParams.get('flexLength'));
    const urlFlexMonths = parseFlexMonths(searchParams.get('flexMonths'));
    if (start || end) {
      setDateRange({ startDate: start, endDate: end });
      setDateMode('dates');
      setFlexDays(urlFlexDays);
    } else if (urlFlexLength) {
      setDateMode('flexible');
      setFlexLength(urlFlexLength);
      setFlexMonths(urlFlexMonths);
      setDateRange({ startDate: null, endDate: null });
    }
    // Only touch guest state when the URL actually carries guest criteria, so an
    // unrelated param change never clobbers an in-progress Who edit.
    if (adultsRaw != null || childrenRaw != null || infantsRaw != null || petsRaw != null || guestsRaw != null) {
      const guestsTotal = guestsRaw != null && guestsRaw.trim() !== '' ? Number(guestsRaw) : NaN;
      // `/` writes only the total: fold it into adults so Who restores. Breakdown
      // params (written by /search) take precedence when present.
      const adultsFallback =
        Number.isFinite(guestsTotal) && guestsTotal > 0
          ? Math.min(Math.max(1, Math.floor(guestsTotal)), MAX_GUESTS)
          : 2;
      const numOr = (raw: string | null, fallback: number): number => {
        if (raw == null || raw.trim() === '') return fallback;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
      };
      setGuestCounts({
        adults: Math.max(1, numOr(adultsRaw, adultsFallback)),
        children: numOr(childrenRaw, 0),
        infants: numOr(infantsRaw, 0),
        pets: numOr(petsRaw, 0),
      });
    }
  }, [searchParams]);

  const closeAllPanels = useCallback(() => {
    closeDestination();
    setIsCalendarOpen(false);
    setIsGuestsOpen(false);
    setHighlightedIndex(-1);
  }, [closeDestination]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (destinationRef.current?.contains(t)) return;
      if (whenRef.current?.contains(t)) return;
      closeDestination();
    };
    const eventName = preserveFlowPointerTargets ? 'click' : 'mousedown';
    document.addEventListener(eventName, onDocClick);
    return () => document.removeEventListener(eventName, onDocClick);
  }, [closeDestination, preserveFlowPointerTargets]);

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
    closeDestination();
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
    const hasAnyDate = dateMode === 'dates' && Boolean(dateRange.startDate || dateRange.endDate);
    if (hasAnyDate) {
      if (!dateRange.startDate || !dateRange.endDate || dateRange.endDate <= dateRange.startDate) {
        setDateError('Please select valid travel dates.');
        ok = false;
      }
    }
    if (guestCounts.adults < 1) {
      ok = false;
    }
    if (!ok) return null;

    return {
      destination: destination.trim(),
      checkIn: dateMode === 'dates' && dateRange.startDate ? toCalendarISO(dateRange.startDate) : undefined,
      checkOut: dateMode === 'dates' && dateRange.endDate ? toCalendarISO(dateRange.endDate) : undefined,
      flexDays: dateMode === 'dates' && dateRange.startDate && dateRange.endDate && flexDays > 0 ? flexDays : undefined,
      flexLength: dateMode === 'flexible' ? flexLength : undefined,
      flexMonths: dateMode === 'flexible' && flexMonths.length > 0 ? flexMonths : undefined,
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
    // TASK-4413 / MKT-022 / TASK-10298931: On marketplace homepage (/), filter grid in-place
    // whether dates are provided or omitted, preserving brand parameter if present.
    if (location.pathname === '/') {
      const p = new URLSearchParams();
      const currentBrand = searchParams.get('brand');
      if (currentBrand?.trim().toLowerCase() === 'atlastays' || isMarketplaceMode()) {
        p.set('brand', currentBrand?.trim() || 'atlastays');
      }
      p.set('city', values.destination.trim());
      if (values.checkIn) p.set('checkIn', values.checkIn);
      if (values.checkOut) p.set('checkOut', values.checkOut);
      if (values.flexDays && values.flexDays > 0 && values.checkIn && values.checkOut) {
        p.set('flexDays', String(values.flexDays));
      }
      if (values.flexLength) {
        p.set('flexLength', values.flexLength);
        if (values.flexMonths && values.flexMonths.length > 0) {
          p.set('flexMonths', values.flexMonths.join(','));
        }
      }
      const guestTotal = values.guests.adults + values.guests.children;
      if (guestTotal > 0) p.set('guests', String(guestTotal));
      navigate({ pathname: '/', search: p.toString() });
    } else {
      navigate({ pathname: '/search', search: buildSearchParams(values, searchParams).toString() });
    }
  };

  const handleClearAll = () => {
    setDestination('');
    setDestinationQuery('');
    setDateRange({ startDate: null, endDate: null });
    setDateMode('dates');
    setFlexDays(0);
    setFlexLength('weekend');
    setFlexMonths([]);
    setGuestCounts({ adults: 2, children: 0, infants: 0, pets: 0 });
    setDestinationError(null);
    setDateError(null);
    clearRecentSearches();
    setRecentEpoch((n) => n + 1);
    closeAllPanels();
    // TASK-1040280: clear URL search params while preserving brand and utm_* params
    const next = new URLSearchParams(searchParams);
    for (const key of ['destination', 'location', 'city', 'checkIn', 'checkOut', 'flexDays', 'flexLength', 'flexMonths', 'guests', 'adults', 'children', 'infants', 'pets']) {
      next.delete(key);
    }
    navigate({ search: next.toString() }, { replace: true });
  };

  const onDestinationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDestinationOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsDestinationOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      closeDestination();
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

  const toggleFlexMonth = (key: string) => {
    setFlexMonths((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key].slice(0, 6),
    );
  };

  const whenLabel =
    dateMode === 'flexible'
      ? formatFlexSummary(flexLength, flexMonths)
      : dateRange.startDate && dateRange.endDate
        ? `${format(dateRange.startDate, 'dd MMM')} – ${format(dateRange.endDate, 'dd MMM')}${
            flexDays > 0 ? ` (±${flexDays} ${flexDays === 1 ? 'day' : 'days'})` : ''
          }`
        : 'Add dates';
  const nights =
    dateMode === 'dates' && dateRange.startDate && dateRange.endDate
      ? calculateNights(dateRange.startDate, dateRange.endDate)
      : 0;

  const mobileSummaryDestination = destinationQuery.trim() || destination.trim() || 'Where';
  const mobileSummaryWhen = whenLabel === 'Add dates' ? 'Any dates' : whenLabel;
  const mobileSummaryGuests = formatGuestSummary(guestCounts);
  const showMobileCompactPill = compactMobile && !mobileExpanded;

  return (
    <form
      onSubmit={handleSearch}
      className="mx-auto w-full max-w-[1200px]"
      data-testid="airbnb-search-bar"
      noValidate
    >
      {showMobileCompactPill && (
        <button
          type="button"
          data-testid="airbnb-search-mobile-pill"
          aria-expanded={false}
          onClick={() => setMobileExpanded(true)}
          className="flex min-h-[48px] w-full items-center gap-3 rounded-full border border-border bg-bg-surface px-4 py-2.5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.10)] md:hidden"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cta-primary,#222)] text-[var(--text-on-cta,#fff)]">
            <Search className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
            {mobileSummaryDestination}
            <span className="mx-1.5 text-text-muted" aria-hidden>·</span>
            <span className="font-normal text-text-muted">{mobileSummaryWhen}</span>
            <span className="mx-1.5 text-text-muted" aria-hidden>·</span>
            <span className="font-normal text-text-muted">{mobileSummaryGuests}</span>
          </span>
        </button>
      )}
      <div
        className={`${showMobileCompactPill ? 'hidden md:flex' : 'flex'} flex-col overflow-hidden rounded-3xl border border-border bg-bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.12)] md:flex-row md:items-stretch md:rounded-full`}
      >
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
                  <li key={`${item.kind}-${item.label}`} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={highlightedIndex === index}
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
              closeDestination();
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
            open={isCalendarOpen && dateMode === 'dates'}
            onClose={() => {
              setIsCalendarOpen(false);
              setActiveDateField(null);
            }}
            value={dateRange}
            onChange={handleRangeChange}
            minDate={today}
            disabledDay={(date) => startOfCalendarDay(date) < today}
            months={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2}
            shownDate={shownDate}
            onShownDateChange={(d) => setShownDate(startOfMonth(d))}
            activeField={activeDateField}
            // TASK-102076: same keep-open contract as SearchAvailabilityWidget —
            // the picker's check-out auto-advance holds step 2, so stay open with
            // focus on check-out instead of dropping the guest mid-flow.
            onActiveFieldChange={(field) => {
              setActiveDateField(field);
              if (field === 'checkout') {
                setIsCalendarOpen(true);
              }
            }}
            afterCalendar={
              <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3" data-testid="date-picker-mode-footer">
                {/* MKT-059: ±1 / ±2 / ±3 day flexibility chips */}
                <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Date flexibility" data-testid="flex-days-chips">
                  {[
                    { value: 0, label: 'Exact dates' },
                    { value: 1, label: '±1 day' },
                    { value: 2, label: '±2 days' },
                    { value: 3, label: '±3 days' },
                  ].map((chip) => {
                    const active = flexDays === chip.value;
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        data-testid={`flex-days-${chip.value}`}
                        aria-pressed={active}
                        onClick={() => setFlexDays(chip.value)}
                        className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-black bg-black text-white'
                            : 'border-border bg-bg-surface text-text-primary hover:border-text-primary'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <div className="inline-flex self-center rounded-full bg-bg-muted p-1" role="tablist" aria-label="Date search mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dateMode === 'dates'}
                    data-testid="date-mode-exact-tab"
                    onClick={() => setDateMode('dates')}
                    className="min-h-[36px] rounded-full bg-bg-surface px-4 py-1.5 text-xs font-semibold text-text-primary shadow-sm"
                  >
                    Choose dates
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={dateMode === 'flexible'}
                    data-testid="date-mode-flexible-tab"
                    onClick={() => {
                      setDateMode('flexible');
                      setDateError(null);
                    }}
                    className="min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
                  >
                    I&apos;m flexible
                  </button>
                </div>
              </div>
            }
          />
          {isCalendarOpen && dateMode === 'flexible' && (
            <div
              id={calendarContentId}
              role="dialog"
              aria-label="Flexible trip dates"
              data-testid="flexible-dates-popover"
              className="absolute left-0 right-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-2xl border border-border bg-bg-surface p-4 shadow-xl md:min-w-[380px]"
            >
              <div className="mb-4 flex justify-center">
                <div className="inline-flex rounded-full bg-bg-muted p-1" role="tablist" aria-label="Date search mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    data-testid="date-mode-exact-tab"
                    onClick={() => setDateMode('dates')}
                    className="min-h-[36px] rounded-full px-4 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
                  >
                    Choose dates
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={true}
                    data-testid="date-mode-flexible-tab"
                    onClick={() => setDateMode('flexible')}
                    className="min-h-[36px] rounded-full bg-bg-surface px-4 py-1.5 text-xs font-semibold text-text-primary shadow-sm"
                  >
                    I&apos;m flexible
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-text-primary">How long would you like to stay?</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Flexible stay length">
                  {FLEX_LENGTH_OPTIONS.map((opt) => {
                    const active = flexLength === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`flex-length-${opt.value}`}
                        aria-pressed={active}
                        onClick={() => setFlexLength(opt.value)}
                        className={`min-h-[44px] rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          active
                            ? 'border-black bg-black text-white'
                            : 'border-border bg-bg-surface text-text-primary hover:border-text-primary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-text-primary">Go anytime in</p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Flexible travel months">
                  {upcomingMonths.map((m) => {
                    const active = flexMonths.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        data-testid={`flex-month-${m.key}`}
                        aria-pressed={active}
                        onClick={() => toggleFlexMonth(m.key)}
                        className={`min-h-[44px] rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          active
                            ? 'border-black bg-black text-white'
                            : 'border-border bg-bg-surface text-text-primary hover:border-text-primary'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  data-testid="flex-dates-done"
                  onClick={() => setIsCalendarOpen(false)}
                  className="min-h-[40px] rounded-full bg-[var(--cta-primary,#222)] px-4 py-1.5 text-xs font-semibold text-[var(--text-on-cta,#fff)]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Who */}
        <div className="relative flex flex-1 items-center gap-3 px-6 py-4 md:pr-2">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-text-primary">Who</span>
            <AirbnbGuestSelector
              value={guestCounts}
              onChange={setGuestCounts}
              maxCapacity={MAX_GUESTS}
              preserveFlowPointerTargets={preserveFlowPointerTargets}
              isOpen={isGuestsOpen}
              onToggle={() => {
                setIsGuestsOpen((v) => !v);
                setIsCalendarOpen(false);
                closeDestination();
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

      <div className={`${showMobileCompactPill ? 'hidden md:flex' : 'mt-3 flex'} items-center justify-end gap-4`}>
        {compactMobile && mobileExpanded && (
          <button
            type="button"
            onClick={() => setMobileExpanded(false)}
            className="inline-flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary md:hidden"
            data-testid="airbnb-search-mobile-collapse"
          >
            Hide search
          </button>
        )}
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
