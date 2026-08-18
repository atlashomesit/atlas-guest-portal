/**
 * AtlasBookingCalendar — hi-fi two-month date-range picker.
 *
 * Visual source of truth: Claude Design Patches/booking-calendar-hifi/
 * Replaces <AtlasDateRangePicker> in UnitBookingWidget.tsx for the unit-booking
 * context ONLY. AtlasDateRangePicker (react-date-range) is untouched.
 *
 * All availability/pricing state is owned by UnitBookingWidget.tsx and passed
 * in as props — this component is purely presentational + UX interaction.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { addDays, format, isSameDay, startOfMonth } from 'date-fns';
import { type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { toCalendarISO } from '@/utils/date';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import './AtlasBookingCalendar.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Day availability state that maps from UnitBookingWidget's dateStatusMap */
export type CalendarDayState = 'available' | 'turnover' | 'unavailable' | 'past';

/** Per-day info handed to DayCell */
interface DayInfo {
  state: CalendarDayState;
  /** Nightly price in INR — omitted/null when unavailable or not yet loaded */
  price: number | null;
}

export interface AtlasBookingCalendarProps {
  /** Whether the popover is open */
  open: boolean;
  /** Called when user closes the calendar (click-outside or escape) */
  onClose: () => void;
  /** Ref to the trigger button — used to position the popover */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  /** Current date-range selection */
  value: AtlasDateRangePickerValue;
  /** Called on each date pick (mirrors AtlasDateRangePicker's onChange API) */
  onChange: (next: AtlasDateRangePickerValue) => void;
  /** Today's normalised date (from UnitBookingWidget's `today` memo) */
  today: Date;
  /** Minimum selectable date */
  minDate: Date;
  /** Maximum selectable date */
  maxDate: Date;
  /** Returns true if a date must be disabled (blocked/hold/past) */
  disabledDay: (date: Date) => boolean;
  /** Day-level status map from availability API */
  dateStatusMap: Map<string, 'Blocked' | 'Available' | 'Hold' | 'Turnover'>;
  /** Calendar per-day prices (ISO string → INR) */
  calendarDailyPrices: Map<string, number>;
  /** Fallback nightly price when calendarDailyPrices has no entry */
  fallbackPrice: number | null;
  /** Whether calendar pricing is still loading */
  pricingLoading: boolean;
  /**
   * Month shown in the left (or only) month panel.
   * Controlled by UnitBookingWidget's shownDate state.
   */
  shownDate: Date;
  onShownDateChange: (date: Date) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// TASK-4278: Sunday-first to match the availability calendar (AvailabilityCalendar, Su-first)
// shown on the same listing page — a single week-start standard (Sunday, common in India)
// avoids guests reading the same date under a different column across the two calendars.
const DOW_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Sunday-first grid offset (0=Sun … 6=Sat) */
function startOfMonthOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun…6=Sat
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatINR(n: number): string {
  if (n >= 10000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ---------------------------------------------------------------------------
// Quick preset definitions
// ---------------------------------------------------------------------------

interface Preset {
  id: string;
  label: string;
}

const PRESETS: Preset[] = [
  { id: 'tonight',      label: 'Tonight' },
  { id: 'this-weekend', label: 'This weekend' },
  { id: 'next-weekend', label: 'Next weekend' },
  { id: 'this-week',    label: 'This week' },
  { id: 'next-month',   label: 'Next month' },
];

// TASK-4847: exported so the preset date-math can be unit-tested (pure function, no DOM).
export function computePreset(id: string, today: Date): { startDate: Date; endDate: Date } | null {
  const dow = today.getDay(); // 0=Sun…6=Sat
  if (id === 'tonight') {
    return { startDate: today, endDate: addDays(today, 1) };
  }
  if (id === 'this-weekend') {
    // TASK-4847: align to AtlasDateRangePicker (the correct reference). The old `(5-dow+7)%7 || 7`
    // fired `|| 7` on Fridays, skipping "this weekend" to next weekend. Drop the `|| 7` so Friday
    // maps to today; special-case Saturday to this Sat→Sun.
    const daysUntilFriday = (5 - dow + 7) % 7; // 0 when today is Friday
    const fri = addDays(today, daysUntilFriday);
    const start = dow === 6 ? today : fri;
    const end = dow === 6 ? addDays(today, 1) : addDays(fri, 2);
    return { startDate: start, endDate: end };
  }
  if (id === 'next-weekend') {
    // TASK-4847: same `|| 7` trap corrupted "next weekend" on Fridays (started this weekend again).
    // Derive from the correctly-computed coming Friday: nextWeekend = thisWeekend's Friday + 7.
    const daysUntilFriday = (5 - dow + 7) % 7; // 0 when today is Friday
    const fri = addDays(today, daysUntilFriday);
    return { startDate: addDays(fri, 7), endDate: addDays(fri, 9) };
  }
  if (id === 'this-week') {
    const toSun = (7 - dow) % 7 || 7;
    return { startDate: today, endDate: addDays(today, toSun) };
  }
  if (id === 'next-month') {
    // First day of next month → 3-night sample stay (the "explore later dates" affordance)
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return { startDate: nextMonthStart, endDate: addDays(nextMonthStart, 3) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// DayCell
// ---------------------------------------------------------------------------

interface DayCellProps {
  date: Date;
  info: DayInfo;
  isToday: boolean;
  range: { checkIn: Date | null; checkOut: Date | null };
  hover: Date | null;
  onPick: (date: Date) => void;
  setHover: (date: Date | null) => void;
  dowIndex: number; // grid column index, 0=first column (Sun) … 6=last column (Sat)
  // Keyboard navigation
  tabIndex: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const DayCell: React.FC<DayCellProps> = ({
  date,
  info,
  isToday,
  range,
  hover,
  onPick,
  setHover,
  dowIndex,
  tabIndex,
  onKeyDown,
}) => {
  const { checkIn, checkOut } = range;

  // Determine end probe (actual checkout or hover target)
  const endProbe = checkOut ?? (hover && hover > (checkIn ?? new Date(0)) ? hover : null);

  const inRange =
    checkIn != null && endProbe != null
      ? date > checkIn && date < endProbe
      : false;

  const isStart = checkIn != null && isSameDay(date, checkIn);
  const isEnd = checkOut != null && isSameDay(date, checkOut);
  const hoverEnd =
    checkOut == null &&
    hover != null &&
    checkIn != null &&
    hover > checkIn &&
    isSameDay(date, hover);
  const isEndpoint = isStart || isEnd || hoverEnd;

  const blocked = info.state === 'unavailable' || info.state === 'past';

  // Range band logic
  const nextDate = addDays(date, 1);
  const prevDate = addDays(date, -1);

  const nextInRange =
    checkIn != null && endProbe != null
      ? nextDate > checkIn && nextDate <= endProbe
      : false;
  const prevInRange =
    checkIn != null && endProbe != null
      ? prevDate >= checkIn && prevDate < endProbe
      : false;

  const showBandLeft = (inRange || isEnd || hoverEnd) && prevInRange;
  const showBandRight = (inRange || isStart) && nextInRange;
  const isFirstOfWeek = dowIndex === 0;
  const isLastOfWeek = dowIndex === 6;

  // Cell class list
  const cellClasses = ['bc-cell'];
  if (info.state === 'past') cellClasses.push('bc-past');
  if (isToday) cellClasses.push('bc-today');
  if (info.state === 'turnover') cellClasses.push('bc-turnover');
  if (info.state === 'unavailable') cellClasses.push('bc-unavail');
  if (isEndpoint) cellClasses.push('bc-endpoint');
  if (inRange) cellClasses.push('bc-inrange');

  const handleClick = () => {
    if (!blocked) onPick(date);
  };
  const handleMouseEnter = () => {
    if (!blocked) setHover(date);
  };

  const ariaLabel = `${format(date, 'd MMMM')}${info.price != null && info.state !== 'past' ? ', ' + formatINR(info.price) : ''}`;

  return (
    <div className="bc-cell-wrap" onMouseEnter={handleMouseEnter}>
      {/* Range band layers */}
      {showBandLeft && (
        <div
          className={`bc-band bc-band-l${isFirstOfWeek ? ' bc-band-edge-l' : ''}`}
        />
      )}
      {showBandRight && (
        <div
          className={`bc-band bc-band-r${isLastOfWeek ? ' bc-band-edge-r' : ''}`}
        />
      )}
      {inRange && !showBandLeft && !showBandRight && (
        <div
          className={`bc-band bc-band-full${isFirstOfWeek ? ' bc-band-edge-l' : ''}${isLastOfWeek ? ' bc-band-edge-r' : ''}`}
        />
      )}
      {isEndpoint && <div className="bc-endpoint-pill" />}

      <button
        type="button"
        className={cellClasses.join(' ')}
        disabled={blocked}
        onClick={handleClick}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        role="gridcell"
        tabIndex={tabIndex}
        aria-selected={isStart || isEnd}
        aria-current={isToday ? 'date' : undefined}
      >
        <span className="bc-num">{date.getDate()}</span>
        {info.price != null && info.state !== 'past' && (
          <span className="bc-price">{formatINR(info.price)}</span>
        )}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------

interface MonthProps {
  year: number;
  month: number;
  range: { checkIn: Date | null; checkOut: Date | null };
  hover: Date | null;
  onPick: (date: Date) => void;
  setHover: (date: Date | null) => void;
  today: Date;
  disabledDay: (date: Date) => boolean;
  dateStatusMap: Map<string, 'Blocked' | 'Available' | 'Hold' | 'Turnover'>;
  calendarDailyPrices: Map<string, number>;
  fallbackPrice: number | null;
  pricingLoading: boolean;
  focusedDate: Date | null;
  onKeyDown: (date: Date, e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const MonthGrid: React.FC<MonthProps> = ({
  year,
  month,
  range,
  hover,
  onPick,
  setHover,
  today,
  disabledDay,
  dateStatusMap,
  calendarDailyPrices,
  fallbackPrice,
  pricingLoading,
  focusedDate,
  onKeyDown,
}) => {
  const dim = daysInMonth(year, month);
  const offset = startOfMonthOffset(year, month);

  // Build flat cell array: nulls for leading blanks, then day numbers
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      className="bc-month"
      onMouseLeave={() => setHover(null)}
    >
      <div className="bc-month-title">
        {MONTH_NAMES[month]}{' '}
        <span className="bc-month-year">{year}</span>
      </div>
      <div className="bc-dow-row">
        {DOW_SUN.map((d) => (
          <div key={d} className="bc-dow">{d}</div>
        ))}
      </div>
      <div className="bc-grid" role="grid">
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} className="bc-cell-wrap bc-empty" />;
          }
          const date = new Date(year, month, d);
          date.setHours(0, 0, 0, 0);
          // CALENDAR basis — see utils/date.ts. UnitBookingWidget's disabledDay /
          // isCheckInAllowed key this same cell through this same helper, so the grid the
          // guest sees and the gate that decides bookability cannot drift apart.
          const iso = toCalendarISO(date);
          const isPast = date.getTime() < today.getTime();
          const isDisabledByWidget = !isPast && disabledDay(date);
          const apiStatus = dateStatusMap.get(iso);

          // TASK-4326: disabledDay is the single source of truth for click-ability —
          // including its checkout exemption for a Blocked/Hold date whose preceding nights
          // (from the selected start date) are all free (checkout is exclusive; the guest
          // never occupies that night). Previously this branch OR'd in a raw
          // `apiStatus === 'Blocked' || 'Hold'` check that re-disabled the exact dates
          // disabledDay had just exempted, so the exemption never had any visible effect —
          // the guest could never click a valid back-to-back checkout day.
          let state: CalendarDayState;
          if (isPast) {
            state = 'past';
          } else if (isDisabledByWidget) {
            state = 'unavailable';
          } else if (apiStatus === 'Turnover') {
            state = 'turnover';
          } else {
            state = 'available';
          }

          // Price: only show for non-past, non-unavailable cells
          let price: number | null = null;
          if (state !== 'past' && state !== 'unavailable') {
            if (calendarDailyPrices.has(iso)) {
              price = calendarDailyPrices.get(iso)!;
            } else if (!pricingLoading && fallbackPrice != null) {
              price = fallbackPrice;
            }
            // If pricingLoading and no cached price, leave null (blank rather than stale)
          }

          const isToday = isSameDay(date, today);

          return (
            <DayCell
              key={i}
              date={date}
              info={{ state, price }}
              isToday={isToday}
              range={range}
              onPick={onPick}
              hover={hover}
              setHover={setHover}
              dowIndex={i % 7}
              tabIndex={focusedDate && isSameDay(date, focusedDate) ? 0 : -1}
              onKeyDown={(e) => onKeyDown(date, e)}
            />
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AtlasBookingCalendar (Calendar + popover)
// ---------------------------------------------------------------------------

export const AtlasBookingCalendar: React.FC<AtlasBookingCalendarProps> = ({
  open,
  onClose,
  anchorRef,
  value,
  onChange,
  today,
  minDate,
  maxDate,
  disabledDay,
  dateStatusMap,
  calendarDailyPrices,
  fallbackPrice,
  pricingLoading,
  shownDate,
  onShownDateChange,
}) => {
  const [hover, setHover] = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});

  // TASK-4439: focus trap + focus return (WCAG 2.4.3 / 2.1.2); Escape close below.
  useFocusTrap<HTMLDivElement>(open, popoverRef);

  // Position the popover below the anchor button, extending left so it stays
  // within the viewport.  Re-runs every time the popover opens or the anchor
  // resizes/scrolls.
  useLayoutEffect(() => {
    if (!open) return;

    const reposition = () => {
      const anchor = anchorRef.current;
      const pop = popoverRef.current;
      if (!anchor || !pop) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popWidth = pop.offsetWidth || 580;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const MARGIN = 8; // px from viewport edges

      // Top: just below anchor (use fixed positioning so scrolling doesn't break it)
      const top = anchorRect.bottom + MARGIN;

      // Prefer right-aligned to the anchor's right edge; shift left if it would overflow
      let left = anchorRect.right - popWidth;
      if (left < MARGIN) left = MARGIN;
      if (left + popWidth > viewportWidth - MARGIN) {
        left = viewportWidth - popWidth - MARGIN;
      }

      // If the popover would go below the viewport, flip it above the anchor
      const popHeight = pop.offsetHeight || 500;
      const finalTop =
        top + popHeight > viewportHeight - MARGIN
          ? Math.max(MARGIN, anchorRect.top - popHeight - MARGIN)
          : top;

      setPositionStyle({
        position: 'fixed',
        top: `${finalTop}px`,
        left: `${left}px`,
      });
    };

    // Run immediately, then again after a paint so offsetWidth is accurate
    reposition();
    const raf = requestAnimationFrame(reposition);

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchorRef]);

  // Derive view-month from shownDate (from UnitBookingWidget)
  const viewYear = shownDate.getFullYear();
  const viewMonth = shownDate.getMonth();

  const canPrev =
    !(viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const goPrev = () => {
    if (!canPrev) return;
    const prev = new Date(viewYear, viewMonth - 1, 1);
    onShownDateChange(startOfMonth(prev));
  };

  const goNext = () => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    if (next > maxDate) return;
    onShownDateChange(startOfMonth(next));
  };

  // Second month: year/month of the next month relative to shownDate
  const m2 = viewMonth + 1 > 11
    ? { year: viewYear + 1, month: 0 }
    : { year: viewYear, month: viewMonth + 1 };

  // Convert AtlasDateRangePickerValue ↔ internal checkIn/checkOut
  const range = {
    checkIn: value.startDate ?? null,
    checkOut: value.endDate ?? null,
  };

  // Stable refs so handlePick useCallback doesn't re-create on every render
  const checkInRef = useRef<Date | null>(value.startDate ?? null);
  const checkOutRef = useRef<Date | null>(value.endDate ?? null);
  checkInRef.current = value.startDate ?? null;
  checkOutRef.current = value.endDate ?? null;

  const handlePick = useCallback(
    (date: Date) => {
      setActivePreset(null);
      const checkIn = checkInRef.current;
      const checkOut = checkOutRef.current;
      // No start yet, or both already set → start new selection
      if (checkIn == null || (checkIn != null && checkOut != null)) {
        onChange({ startDate: date, endDate: null });
        return;
      }
      // Have checkIn only: if picked ≤ checkIn, restart
      if (date <= checkIn) {
        onChange({ startDate: date, endDate: null });
        return;
      }
      // Complete the selection
      onChange({ startDate: checkIn, endDate: date });
    },
    [onChange],
  );

  const handlePreset = (id: string) => {
    const preset = computePreset(id, today);
    if (!preset) return;
    // Validate against minDate / maxDate
    if (preset.startDate < minDate || preset.endDate > maxDate) return;
    setActivePreset(id);
    onChange(preset);
    // Jump view to the preset check-in month
    onShownDateChange(startOfMonth(preset.startDate));
  };

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, onClose, anchorRef]);

  // TASK-4512: Initialize focusedDate to today or minDate when calendar opens.
  // 2026-07-09 (NOCHECK: doc date): anchor on the first SELECTABLE date — a blocked/past
  // anchor renders as a `disabled` button, which cannot take DOM focus, so keyboard
  // navigation could never start. Falls back to the raw anchor if the whole range is full.
  useEffect(() => {
    if (open && focusedDate === null) {
      const base = today >= minDate ? today : minDate;
      let anchor = base;
      let guard = 0;
      while (anchor <= maxDate && (anchor < today || disabledDay(anchor)) && guard < 366) {
        anchor = addDays(anchor, 1);
        guard += 1;
      }
      setFocusedDate(anchor <= maxDate ? anchor : base);
    }
  }, [open, minDate, maxDate, today, focusedDate, disabledDay]);

  // Keyboard navigation handler for arrow keys
  const handleGridKeyDown = useCallback(
    (date: Date, e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(e.key)) {
        return;
      }

      e.preventDefault();

      // Enter/Space = select the date
      if (e.key === 'Enter' || e.key === ' ') {
        handlePick(date);
        return;
      }

      // Arrow navigation
      let nextDate = new Date(date);
      const DOW = date.getDay(); // 0=Sun…6=Sat
      // Direction of travel for the disabled-date skip-scan below (arrows only).
      let scanStep = 0;

      if (e.key === 'ArrowLeft') {
        nextDate = addDays(date, -1);
        scanStep = -1;
      } else if (e.key === 'ArrowRight') {
        nextDate = addDays(date, 1);
        scanStep = 1;
      } else if (e.key === 'ArrowUp') {
        nextDate = addDays(date, -7);
        scanStep = -7;
      } else if (e.key === 'ArrowDown') {
        nextDate = addDays(date, 7);
        scanStep = 7;
      } else if (e.key === 'Home') {
        // Home = first day of week (Sunday)
        nextDate = addDays(date, -DOW);
      } else if (e.key === 'End') {
        // End = last day of week (Saturday)
        nextDate = addDays(date, 6 - DOW);
      }

      // 2026-07-09 (NOCHECK: doc date): a target that is blocked/past renders as a
      // `disabled` button, which cannot take DOM focus — the roving tabindex would move
      // there while DOM focus stays stranded on the old cell (gate 9c: ArrowDown +7 landed
      // on a booked date). Arrows skip further in the direction of travel to the next
      // selectable date; Home/End (and a fully-blocked remaining range) don't move at all.
      const isUnfocusable = (d: Date) => d < today || disabledDay(d);
      if (scanStep !== 0) {
        let guard = 0;
        while (nextDate >= minDate && nextDate <= maxDate && isUnfocusable(nextDate) && guard < 60) {
          nextDate = addDays(nextDate, scanStep);
          guard += 1;
        }
      }
      if (isUnfocusable(nextDate)) {
        return;
      }

      // Clamp to valid range
      if (nextDate >= minDate && nextDate <= maxDate) {
        setFocusedDate(nextDate);

        // If navigating out of the shown month, advance the view
        if (nextDate.getMonth() !== viewMonth || nextDate.getFullYear() !== viewYear) {
          const targetMonth = nextDate.getMonth();
          const targetYear = nextDate.getFullYear();
          onShownDateChange(new Date(targetYear, targetMonth, 1));
        }

        // Immediately focus the new button (will happen on next render).
        // BUG FIX 2026-07-08: this selected the FIRST enabled gridcell, so arrow keys
        // snapped DOM focus back to cell #1 on every keystroke — keyboard users could
        // never move. The roving-tabindex cell ([tabindex="0"]) IS the new focusedDate
        // after re-render; focus that.
        setTimeout(() => {
          const btn = popoverRef.current?.querySelector(
            `button[role="gridcell"][tabindex="0"]`
          ) as HTMLButtonElement | null;
          btn?.focus();
        }, 0);
      }
    },
    [handlePick, minDate, maxDate, today, disabledDay, viewMonth, viewYear, onShownDateChange, popoverRef],
  );

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Reset hover when calendar closes
  useEffect(() => {
    if (!open) setHover(null);
  }, [open]);

  if (!open) return null;

  return (
    <div ref={popoverRef} className="bc-popover" style={positionStyle} role="dialog" aria-label="Select dates">
      <div className="bc-root">
        {/* Quick presets */}
        <div className="bc-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`bc-chip${activePreset === p.id ? ' bc-chip-active' : ''}`}
              onClick={() => handlePreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="bc-nav">
          <button
            type="button"
            className="bc-nav-btn"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="bc-nav-btn"
            onClick={goNext}
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Two months */}
        <div className="bc-months bc-months-2">
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            range={range}
            hover={hover}
            onPick={handlePick}
            setHover={setHover}
            today={today}
            disabledDay={disabledDay}
            dateStatusMap={dateStatusMap}
            calendarDailyPrices={calendarDailyPrices}
            fallbackPrice={fallbackPrice}
            pricingLoading={pricingLoading}
            focusedDate={focusedDate}
            onKeyDown={handleGridKeyDown}
          />
          <MonthGrid
            year={m2.year}
            month={m2.month}
            range={range}
            hover={hover}
            onPick={handlePick}
            setHover={setHover}
            today={today}
            disabledDay={disabledDay}
            dateStatusMap={dateStatusMap}
            calendarDailyPrices={calendarDailyPrices}
            fallbackPrice={fallbackPrice}
            pricingLoading={pricingLoading}
            focusedDate={focusedDate}
            onKeyDown={handleGridKeyDown}
          />
        </div>

        {/* Legend */}
        <div className="bc-legend">
          <div className="bc-legend-item">
            <span className="bc-sw bc-sw-available" />
            Available
          </div>
          <div className="bc-legend-item">
            <span className="bc-sw bc-sw-turnover" />
            Turnover · bookable
          </div>
          <div className="bc-legend-item">
            <span className="bc-sw bc-sw-unavail" />
            Unavailable
          </div>
          <div className="bc-legend-item">
            <span className="bc-sw bc-sw-selected" />
            Your stay
          </div>
        </div>
      </div>
    </div>
  );
};

export default AtlasBookingCalendar;
