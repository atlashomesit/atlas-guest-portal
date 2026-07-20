
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { NETWORK_ERROR_MESSAGE } from './unitBookingPaymentOrderErrors';
import { Button } from '@/components/ui/Button';
import { type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { AtlasBookingCalendar } from './AtlasBookingCalendar';
import { useBooking } from '@/contexts/BookingContext';
import { hasRuntimeConfig } from '@/runtime-config';
import ErrorBanner from '@/components/ErrorBanner';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import { dedupedAvailabilityCalendarFetch } from '@/api/availabilityCalendarClient';
import { getIstStartOfDay } from '@/utils/date';
import { calculateNights, formatDateInTimezone, formatIsoDateInTimezone } from '@/utils/dateHelpers';
import {
  type CancellationTier,
  computeCancellationDeadline,
  computeEffectiveCancellationDeadline,
  formatCancellationDeadline,
} from '@/utils/cancellationPolicy';
import { doesRangeIntersectBlocked, toISODate } from '@/utils/dateRange';
import { formatCurrency } from '@/utils/formatting';
import { HelpCircle } from 'lucide-react';
import { calculateNightlyPrice, inferUnitType } from '@/utils/pricing';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import { fetchCalendarPricing, fetchGuestGstBreakdown } from '@/api/pricingClient';
import { fetchPublicListings } from '@/api/listingClient';
import { useListingPhotosFromApi } from '@/contexts/ListingPhotosContext';
import OptimizedImage from '@/components/ui/OptimizedImage';
import FomoBar from '@/components/FomoBar';
import { track } from '@/lib/events'; // TASK-1480
// getTenantContext removed — widget no longer needs it (TASK-2612 stripped form)
import {
  ILLUSTRATIVE_OTA_GUEST_FEE_PERCENT,
} from '@/utils/directBookingPromo';
import { accommodationGstLineAmount, accommodationGstSlabPercent } from '@/utils/guestPriceEstimate';

declare global {
  interface Window {
    Razorpay: new (...args: unknown[]) => {
      open: (options?: unknown) => void;
      on: (event: string, handler: (r: unknown) => void) => void;
    };
  }
}

interface UnitBookingWidgetProps {
  listingId?: string | number;
  propertyId?: string | number;
  listingName?: string;
  /** IANA timezone for date display (e.g. Asia/Kolkata). From listing/property. */
  timezoneId?: string;
  /** Cover image from listing/API (e.g. property gallery). Falls back to /listings/public cache. */
  coverPhotoUrl?: string;
  /** Maximum guests for this listing. Defaults to 16 if not provided. */
  maxGuests?: number;
  /** Optional host WhatsApp/phone for payment-failure support CTA. */
  hostPhone?: string | null;
  /** TASK-2612: Property route slug — used for navigate to /book/:propertySlug/:unitSlug/details */
  propertySlug?: string;
  /** TASK-2612: Unit route slug — used for navigate to /book/:propertySlug/:unitSlug/details */
  unitSlug?: string;
  /** TASK-2623: Average rating from the listing API (e.g. 4.92). Only shown when reviewCount > 0. */
  reviewRating?: number;
  /** TASK-2623: Total review count from the listing API. 0 or undefined = hide rating row. */
  reviewCount?: number;
  /** TASK-956: minimum nights required — shown before the calendar opens. */
  minStayNights?: number;
}

/** Detect network/connection failures (timeout, offline, ECONNREFUSED, etc.). */
function isNetworkError(error: unknown): boolean {
  const err = error as { code?: string; message?: string; response?: { status?: number } };
  const msg = (err?.message ?? '').toLowerCase();
  const code = (err?.code ?? '').toLowerCase();
  if (err?.response?.status === 0 || err?.response === undefined) {
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('failed to fetch')) return true;
  }
  if (code === 'econnrefused' || code === 'etimedout' || code === 'err_network' || code === 'econnreset') return true;
  if (msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('network error')) return true;
  if (err?.response?.status === 502 || err?.response?.status === 503 || err?.response?.status === 504) return true;
  return false;
}

/** Map API error to actionable guest-facing message (quote/availability/payment/duplicate/network). */
function getBookingErrorMessage(error: unknown, context: 'order' | 'verify'): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  const status = (error as { response?: { status?: number } })?.response?.status;
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  const message = (typeof data?.message === 'string' ? data.message : '') || (error as Error)?.message || '';

  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('quote') && (lower.includes('invalid') || lower.includes('expired'))) {
    return 'Your quote has expired. Please select dates again and complete the booking.';
  }
  if (status === 409 && (lower.includes('confirmed booking') || lower.includes('already exists'))) {
    return 'A confirmed booking already exists for these dates. Check your email for the booking confirmation.';
  }
  if (lower.includes('not available') || lower.includes('no longer available') || lower.includes('sold out') || status === 409) {
    return 'Those dates are no longer available. Please choose different dates and try again.';
  }
  if (context === 'verify') {
    if (lower.includes('already') && (lower.includes('confirm') || lower.includes('verified'))) {
      return 'This payment was already confirmed. Check your email for the booking details.';
    }
    return `Payment verification failed. ${message ? `${message}. ` : ''}Please contact support with your payment ID if you were charged.`;
  }
  if (status === 400 && (lower.includes('date') || lower.includes('availability'))) {
    return 'The selected dates are no longer available. Please pick different dates and try again.';
  }
  if (lower.includes('consent') && lower.includes('booking')) {
    return 'Please accept the data processing consent below and try again.';
  }
  return context === 'order'
    ? 'We couldn\'t start checkout. Please check your dates and try again, or contact support.'
    : 'Payment verification failed. Please contact support with your payment ID.';
}

/** Day-level status derived from public availability calendar API. */
type ListingCalendarDayStatus = 'Blocked' | 'Available' | 'Hold' | 'Turnover';

const UnitBookingWidget: React.FC<UnitBookingWidgetProps> = ({
  listingId,
  propertyId,
  listingName,
  timezoneId,
  coverPhotoUrl,
  maxGuests = 16,
  hostPhone,
  propertySlug,
  unitSlug,
  reviewRating,
  reviewCount,
  minStayNights: minStayNightsProp,
}) => {
  if (import.meta.env.DEV) {
    console.assert(Boolean(propertyId), '[UnitBookingWidget] propertyId is required for unit mode');
  }

  const navigate = useNavigate();
  const { booking, updateBooking } = useBooking();
  const { getUrlsForListingId } = useListingPhotosFromApi();
  const isBookingDisabled = !hasRuntimeConfig();

  // TASK-2612: WhatsApp direct-booking handled on GuestDetailsPage (after Reserve).
  // Widget now only handles init-hold; provider routing happens on details page.

  const coverFromPublicListings = useMemo(() => {
    const id = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return getUrlsForListingId(id)?.[0];
  }, [listingId, getUrlsForListingId]);

  const displayCoverUrl = (coverPhotoUrl?.trim() || coverFromPublicListings || '').trim() || undefined;
  void hostPhone; // passed through for listing pages; payment-failure support lives on GuestDetailsPage

  const today = useMemo(() => getIstStartOfDay(), []);
  const maxBookingDate = useMemo(() => addDays(today, 365), [today]);

  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
  // TASK-4911: separate ref for the check-out cell so an incomplete-date Reserve click can
  // focus whichever field is actually missing.
  const checkoutCellRef = useRef<HTMLButtonElement | null>(null);
  const dateErrorId = useId();

  const [dateRange, setDateRange] = useState<AtlasDateRangePickerValue>({
    startDate: null,
    endDate: null,
  });
  const [openCalendar, setOpenCalendar] = useState(false);
  const [shownDate, setShownDate] = useState<Date>(today);
  const shownMonthIso = useMemo(() => toISODate(startOfMonth(shownDate)), [shownDate]);
  const [calendarDailyPrices, setCalendarDailyPrices] = useState<Map<string, number>>(new Map());
  const [calendarConvenienceFeePercent, setCalendarConvenienceFeePercent] = useState<number | undefined>(undefined);
  const [calendarPricingLoading, setCalendarPricingLoading] = useState(false);
  // TASK-4629: while calendar-open pricing refetch is in flight, keep showing the last settled
  // headline instead of a mid-refetch lower total (fee/GST flash under F1 latency).
  const [calendarOpenPricingPending, setCalendarOpenPricingPending] = useState(false);
  const lastSettledHeadlineRef = useRef(0);
  const calendarOpenFetchGenRef = useRef(0);
  const openPricingInflightRef = useRef(0);
  // TASK-4303: pricing fetch terminally failed (network/API error, not an abort). Only then do
  // we degrade to the base-rate fallback estimate instead of holding the loading skeleton.
  const [calendarPricingFailed, setCalendarPricingFailed] = useState(false);
  // TASK-4331: server-computed GST slab/amount (post-LOS/last-minute/min-floor basis),
  // preferred over the client-derived slab below when available.
  const [serverGstPercent, setServerGstPercent] = useState<number | null>(null);
  const [serverGstAmount, setServerGstAmount] = useState<number | null>(null);
  // TASK-5184: server FinalAmount includes tourist tax; client recomputes omit it.
  const [serverFinalAmount, setServerFinalAmount] = useState<number | null>(null);
  const [guests, setGuests] = useState(2);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [_bookedDates, setBookedDates] = useState<Date[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [dateStatusMap, setDateStatusMap] = useState<Map<string, ListingCalendarDayStatus>>(new Map());
  // Availability fetch must NOT gate Reserve (TASK-4277 / 2026-07-12 hosted-dev: a prior
  // `isLoading` flag left Reserve disabled during F1 availability latency after check-in-only).
  //
  // TASK-4830: a *terminal failure* of the availability fetch is different from mere latency.
  // When the GET fails (404 / CORS / `Failed to fetch` / 5xx / parse error), `dateStatusMap`
  // and `blockedSet` stay empty — which `checkInteriorNightOverlap`/`checkinUnavailable` read
  // as "every night is free". That would leave Reserve enabled on already-booked nights. This
  // flag lets the UI fail *closed* on failure (disable Reserve + offer retry) while STILL not
  // gating on the loading/latency window (that stays TASK-4277-compliant — see the fetch effect).
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastAvailabilityKeyRef = useRef<string | null>(null);
  const hasHydratedFromContextRef = useRef(false);
  // TASK-4726 fix: the URL-hydration effect below runs as soon as ?checkIn=/?checkOut= are
  // parsed — typically before the async availability-calendar GET (fetchBlockedDates) has
  // resolved, so blockedSet/dateStatusMap are still empty and an interior-night overlap is
  // invisible to `checkInteriorNightOverlap` at that moment. Remember the hydrated range here
  // so a second effect (below) can re-validate it once real availability data arrives, without
  // re-deriving dateRange from the URL every time blockedSet/dateStatusMap change (which would
  // clobber a date range the guest has since edited by hand).
  const hydratedRangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [resolvedMinStay, setResolvedMinStay] = useState(1);
  // TASK-4334: cancellation tier drives the trust-strip deadline computation below.
  const [resolvedCancellationTier, setResolvedCancellationTier] = useState<CancellationTier | null>(null);
  // TASK-4356: server-computed window (hours), source of truth — overrides the local tier→hours map.
  const [resolvedCancellationWindowHours, setResolvedCancellationWindowHours] = useState<number | null>(null);
  // TASK-4405: server-resolved universal grace-window hours. Null when Cancellation:UniversalGraceEnabled
  // is off server-side — never hardcode a fallback here (flag-off parity).
  const [resolvedGraceHours, setResolvedGraceHours] = useState<number | null>(null);
  const minAdvanceDays: number = 0;

  useEffect(() => {
    if (minStayNightsProp != null && Number.isFinite(minStayNightsProp) && minStayNightsProp > 0) {
      setResolvedMinStay(Math.max(1, Math.floor(minStayNightsProp)));
      return;
    }
    const id = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      setResolvedMinStay(1);
      return;
    }
    const ctrl = new AbortController();
    fetchPublicListings(ctrl.signal)
      .then((listings) => {
        const match = listings.find((l) => l.id === id);
        setResolvedMinStay(Math.max(1, match?.minStay ?? 1));
        setResolvedCancellationTier(match?.cancellationTier ?? null);
        setResolvedCancellationWindowHours(match?.cancellationWindowHours ?? null);
        setResolvedGraceHours(match?.graceHours ?? null);
      })
      .catch(() => {
        setResolvedMinStay(1);
        setResolvedCancellationTier(null);
        setResolvedCancellationWindowHours(null);
        setResolvedGraceHours(null);
      });
    return () => ctrl.abort();
  }, [listingId, minStayNightsProp]);

  const minStayNights = resolvedMinStay;
  const effectiveMaxGuests = maxGuests;
  /** RA-006: payment provider not configured for this tenant. */
  const [providerBlocked, setProviderBlocked] = useState(false);

  // TASK-4551: Availability range must cover the full selectable booking range (today + 365 days)
  // to prevent booked dates beyond 60 days from appearing available. Re-fetch when shown month changes.
  const availabilityRange = useMemo(() => {
    const startDate = today; // Always start from today
    const endDate = maxBookingDate; // Cover full 365-day range
    return { startDate, endDate };
  }, [today, maxBookingDate]);

  useEffect(() => {
    if (!isBookingDisabled || !openCalendar) return;
    setOpenCalendar(false);
  }, [isBookingDisabled, openCalendar]);

  useEffect(() => {
    if (!openCalendar) {
      lastAvailabilityKeyRef.current = null;
    }
  }, [openCalendar, listingId]);

  // Reset shownDate to current month whenever calendar opens
  // This ensures calendar always opens from current month, regardless of selected dates or previous navigation
  useEffect(() => {
    if (openCalendar) {
      setShownDate(today);
    }
  }, [openCalendar, today]);

  // TASK-4629: rising-edge open with a selected range starts a headline freeze. Open-triggered
  // pricing fetches (shown-month + selected-month) clear it via openPricingInflightRef.
  // If neither fetch starts (effects early-return), the timeout clears the freeze.
  useEffect(() => {
    if (!openCalendar) {
      calendarOpenFetchGenRef.current += 1; // invalidate in-flight open fetches
      openPricingInflightRef.current = 0;
      setCalendarOpenPricingPending(false);
      return;
    }
    if (!dateRange.startDate || !dateRange.endDate) {
      setCalendarOpenPricingPending(false);
      return;
    }
    const gen = ++calendarOpenFetchGenRef.current;
    openPricingInflightRef.current = 0;
    setCalendarOpenPricingPending(true);
    const t = window.setTimeout(() => {
      if (gen === calendarOpenFetchGenRef.current && openPricingInflightRef.current === 0) {
        setCalendarOpenPricingPending(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [openCalendar, dateRange.startDate, dateRange.endDate]);

  const openCalendarRef = useRef(openCalendar);
  openCalendarRef.current = openCalendar;
  const hasRangeRef = useRef(false);
  hasRangeRef.current = Boolean(dateRange.startDate && dateRange.endDate);

  const beginCalendarOpenPricingFetch = (gen: number) => {
    if (gen !== calendarOpenFetchGenRef.current) return;
    openPricingInflightRef.current += 1;
  };
  const endCalendarOpenPricingFetch = (gen: number) => {
    if (gen !== calendarOpenFetchGenRef.current) return;
    openPricingInflightRef.current = Math.max(0, openPricingInflightRef.current - 1);
    if (openPricingInflightRef.current === 0) {
      setCalendarOpenPricingPending(false);
    }
  };

  // Reset hydration flag when listing changes so URL/`BookingContext` dates re-apply after
  // PropertyDetails resolves listingId (undefined→id).
  useEffect(() => {
    hasHydratedFromContextRef.current = false;
  }, [listingId]);


  useEffect(() => {
    try {
      // Persist referral code from URL to localStorage so GuestDetailsPage can pick it up
      const url = new URL(window.location.href);
      const ref = (url.searchParams.get('ref') || '').trim().slice(0, 32);
      if (ref) {
        window.localStorage.setItem('atlas_guest_referral_code', ref);
      }
    } catch {
      // no-op
    }
  }, []);

  // Close guests popover on outside click
  useEffect(() => {
    if (!guestsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.bw-guests')) setGuestsOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [guestsOpen]);

  // TASK-1708: Persist promo code from ?promo= URL param to localStorage so GuestDetailsPage can pick it up
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const promo = (url.searchParams.get('promo') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
      if (promo) window.localStorage.setItem('atlas_guest_promo_code', promo);
    } catch {
      // no-op
    }
  }, []);

  // TASK-2630: Listen for custom event from bottom Availability calendar (BUG-15b).
  // When user clicks a date in the AvailabilityCalendar, it dispatches atlas:set-checkin with the date (ISO string).
  // We update the booking widget to reflect that check-in date.
  useEffect(() => {
    const handleAvailabilityDateSelect = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const dateStr = customEvent.detail;
      if (!dateStr || typeof dateStr !== 'string') return;

      try {
        // Parse the date string (expected format: YYYY-MM-DD)
        const selectedDate = getIstStartOfDay(new Date(dateStr));
        if (Number.isNaN(selectedDate.getTime())) return;

        // Update the date range: set check-in to the selected date, clear check-out
        // This prompts the user to select a check-out date
        setDateRange({ startDate: selectedDate, endDate: null });

        // Optionally scroll to the date picker to make it visible
        if (calendarButtonRef.current) {
          calendarButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch {
        // Silently handle parse errors
      }
    };

    window.addEventListener('atlas:set-checkin', handleAvailabilityDateSelect);
    return () => window.removeEventListener('atlas:set-checkin', handleAvailabilityDateSelect);
  }, []);

  // Hydrate widget from booking context (e.g. ?checkIn=&checkOut=&guests= from property URL)
  // TASK-2630: Ensure AtlasBookingCalendar displays URL-param dates, not today+1/today+2 defaults
  // TASK-4293: `listingId` is a dep so this re-runs after PropertyDetails resolves the listing
  // id (undefined→N) and the listingId-change effect clears hasHydratedFromContextRef.
  useEffect(() => {
    const ci = booking.checkIn;
    const co = booking.checkOut;
    if (!ci || !co) return;
    const start = getIstStartOfDay(new Date(ci));
    const end = getIstStartOfDay(new Date(co));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (end.getTime() <= start.getTime()) return;
    // TASK-4285: URL-param dates (?checkIn=&checkOut=) bypass the calendar's past-date guard.
    // Reject a past-dated check-in — still hydrate the fields so the guest sees what was
    // requested, but surface an explicit error and let `invalidIstStayRange` keep the Reserve
    // button disabled + the price quote hidden (no wasted quote, no past-dated hold).
    if (start.getTime() < today.getTime()) {
      setDateRange({ startDate: start, endDate: end });
      setDateError('Check-in date must be today or in the future.');
      hasHydratedFromContextRef.current = true;
      hydratedRangeRef.current = { start, end };
      return;
    }
    // TASK-4556: enforce min-stay on URL-hydrated dates
    const nights = calculateNights(start, end);
    if (minStayNights > 1 && nights < minStayNights) {
      setDateRange({ startDate: start, endDate: end });
      setDateError(`Minimum stay is ${minStayNights} nights.`);
      hasHydratedFromContextRef.current = true;
      hydratedRangeRef.current = { start, end };
      return;
    }
    // TASK-4726: check interior-night overlaps on URL-hydrated dates. NOTE: at first run this
    // effect very likely fires before the availability-calendar GET resolves, so blockedSet/
    // dateStatusMap can still be empty here — see the hydratedRangeRef re-validation effect
    // below, which catches an overlap that only becomes visible once that fetch settles.
    if (checkInteriorNightOverlap(start, end)) {
      setDateRange({ startDate: start, endDate: end });
      setDateError('These dates overlap an existing booking or hold.');
      hasHydratedFromContextRef.current = true;
      hydratedRangeRef.current = { start, end };
      return;
    }
    setDateRange({ startDate: start, endDate: end });
    hasHydratedFromContextRef.current = true;
    hydratedRangeRef.current = { start, end };
  }, [booking.checkIn, booking.checkOut, today, listingId, minStayNights]);

  // TASK-4726 fix: re-validate a URL-hydrated range against interior-night overlaps once the
  // availability-calendar fetch (blockedSet/dateStatusMap) has actually loaded. The hydration
  // effect above runs on mount using whatever blockedSet/dateStatusMap happen to be in scope at
  // that instant — on a fresh page load that's before the async GET resolves, so a booked night
  // in the MIDDLE of the URL-hydrated range (edges still open) was silently missed and Reserve
  // stayed enabled. Only acts while the guest hasn't changed the selection away from the
  // hydrated range (compares against hydratedRangeRef), so it never clobbers a manual edit.
  useEffect(() => {
    const hydrated = hydratedRangeRef.current;
    if (!hydrated) return;
    if (
      !dateRange.startDate ||
      !dateRange.endDate ||
      dateRange.startDate.getTime() !== hydrated.start.getTime() ||
      dateRange.endDate.getTime() !== hydrated.end.getTime()
    ) {
      return;
    }
    if (checkInteriorNightOverlap(hydrated.start, hydrated.end)) {
      setDateError('These dates overlap an existing booking or hold.');
    }
  }, [blockedSet, dateStatusMap, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    const g = booking.guests;
    if (typeof g === 'number' && g >= 1 && g <= effectiveMaxGuests) {
      setGuests(g);
    }
  }, [booking.guests, effectiveMaxGuests]);

  useEffect(() => {
    setGuests((current) => Math.min(effectiveMaxGuests, Math.max(1, current)));
  }, [effectiveMaxGuests]);

  // Bumped after an availability conflict (409) to force a fresh calendar fetch.
  const [availabilityRefreshNonce, setAvailabilityRefreshNonce] = useState(0);

  // Fetch availability automatically on component load and when the calendar is opened
  // Availability always starts from today, independent of selected dates
  useEffect(() => {
    if (!listingId || isBookingDisabled) return;

    // Fetch on mount only - availability range is recalculated on mount and doesn't need constant refetching

    let isActive = true;

    const fetchBlockedDates = async () => {
      try {
        const url = new URL(buildApiUrl(`/api/public/listings/${Number(listingId)}/availability-calendar`));
        url.searchParams.set('from', toISODate(getIstStartOfDay(availabilityRange.startDate)));
        url.searchParams.set('to', toISODate(getIstStartOfDay(availabilityRange.endDate)));

        const availabilityKey = url.toString();
        if (lastAvailabilityKeyRef.current === availabilityKey) {
          return;
        }
        lastAvailabilityKeyRef.current = availabilityKey;

        setStatusMessage('Checking availability...');

        // TASK-2118: use dedupedAvailabilityCalendarFetch — module-level in-flight
        // dedup shares a single GET with the sibling AvailabilityCalendar component
        // and across React StrictMode double-mount. Single attempt (no apiFetch
        // retries on 5xx/network — retries against a cold dev API push the count
        // above MAX_GETS=4).
        const response = await dedupedAvailabilityCalendarFetch(availabilityKey, { headers: getApiHeaders() });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json() as unknown;
        const entries = Array.isArray(data) ? (data as Array<{ date?: string; status?: string }>) : [];
        
        if (!isActive) return;
        
        // Filter out past dates and process availability with status
        const newBlockedDates = new Set<string>();
        const newDateStatusMap = new Map<string, ListingCalendarDayStatus>();
        
        entries.forEach((item) => {
          const dateStr = item?.date;
          if (!dateStr) return;
          
          const itemDate = getIstStartOfDay(new Date(dateStr));
          const itemISO = toISODate(itemDate);
          
          // Filter out past dates - only process dates from today onwards (inclusive)
          // Use <= instead of < to ensure today is included, but we want >= today, so keep <
          if (itemDate.getTime() < today.getTime()) return;
          
          const normalizedStatus = String(item?.status ?? '').toLowerCase();
          const status: ListingCalendarDayStatus =
            normalizedStatus === 'booked'
              ? 'Blocked'
              : normalizedStatus === 'blocked'
                ? 'Blocked'
                : normalizedStatus === 'hold'
                  ? 'Hold'
                  : normalizedStatus === 'turnover'
                    ? 'Turnover'
                    : 'Available';

          // Store status for rendering
          newDateStatusMap.set(itemISO, status);

          // Update blockedSet for backward compatibility with existing logic
          // Booked, Blocked and Hold dates should be in blockedSet (all are non-selectable). Turnover is bookable.
          const isBlocked =
            status === 'Blocked' ||
            status === 'Hold';
          
          if (isBlocked) {
            newBlockedDates.add(itemISO);
          }
        });
        
        setBlockedSet(newBlockedDates);
        setDateStatusMap(newDateStatusMap);
        // TASK-4830: a successful load means the maps are authoritative again — clear any
        // prior failure so Reserve is re-enabled (or correctly gated by real blocked dates).
        setAvailabilityFailed(false);
        setBookedDates(Array.from(newBlockedDates).map(date => new Date(date)));
        const hasTurnover = Array.from(newDateStatusMap.values()).some((s) => s === 'Turnover');
        setStatusMessage(
          hasTurnover
            ? 'Light grey “Turnover” nights are cleaning windows — still bookable. Striped grey is unavailable (blocked or on hold).'
            : newBlockedDates.size > 0
              ? 'Striped grey dates are unavailable (blocked or on hold) and cannot be selected.'
              : 'All dates shown are available to book.'
        );
      } catch (error) {
        // A cancelled request (StrictMode double-mount / unmount abort) is NOT a real
        // failure — leave existing availability state untouched and do not fail-close.
        const isCancelled = error instanceof Error && error.name === 'AbortError';
        if (isCancelled || !isActive) return;

        // TASK-4830: every other error (404 / CORS / `Failed to fetch` / 5xx / JSON parse)
        // is a genuine failure. Previously these were swallowed silently, leaving the empty
        // dateStatusMap/blockedSet to read as "all nights open" with Reserve still enabled —
        // a guest could reserve already-booked nights and only hit a later server 409 (if any).
        // Fail CLOSED instead: flag the failure so the Reserve button disables and a retry is
        // offered. Do NOT confuse this with the loading window (TASK-4277 — never gated).
        const errorMessage = (error as { message?: string })?.message ?? String(error);
        const is404 = errorMessage.includes('HTTP 404') || errorMessage.includes('404');
        const isCors = errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch');
        // Keep the noisy console.error only for genuinely unexpected errors; 404/CORS are
        // known-transient shapes (cold F1 dev API, cross-origin) and stay quiet.
        if (!is404 && !isCors) {
          console.error('Error fetching blocked dates:', error);
        }
        setAvailabilityFailed(true);
        setStatusMessage('');
        // Allow a manual retry to re-issue the GET for the same range: the effect early-returns
        // when lastAvailabilityKeyRef still holds this URL, so clear it here (the retry handler
        // bumps availabilityRefreshNonce to re-run the effect).
        lastAvailabilityKeyRef.current = null;
      }
    };

    fetchBlockedDates();
    
    return () => {
      isActive = false;
    };
    // availabilityRange is memoized and stable; rely on lastAvailabilityKeyRef deduplication for same requests
  }, [listingId, isBookingDisabled, availabilityRange, today, availabilityRefreshNonce]);

  // TASK-4830: manual retry after an availability-fetch failure. Clear the dedup key (the fetch
  // effect early-returns while lastAvailabilityKeyRef still holds this URL) and bump the nonce so
  // the effect re-runs and re-issues the GET. `availabilityFailed` stays true until a load
  // succeeds, so Reserve remains fail-closed through the retry's loading window.
  const handleAvailabilityRetry = useCallback(() => {
    lastAvailabilityKeyRef.current = null;
    setAvailabilityRefreshNonce((n) => n + 1);
  }, []);

  // Fetch per-day calendar pricing so price updates when user selects dates.
  // Fetch on mount and when calendar opens or month changes; do not clear when calendar closes.
  //
  // TASK-4327: MERGE fetched months into the existing map instead of replacing it wholesale.
  // Calendar open resets `shownDate` to today (below), which re-fires this effect for
  // months 0-2 from today. A prior `setCalendarDailyPrices(result.dateToPrice)` REPLACE
  // wiped out any far-out months a guest had already selected/priced, so
  // `selectedRangeTotalFromCalendar` fell back to today's rate for a range 4+ months out —
  // silently changing the displayed total on nothing but a close/reopen. Each server
  // response is authoritative for its OWN date range (30s cache per PricingController), so
  // merging never leaves stale data for the months it actually returns.
  useEffect(() => {
    if (!listingId || String(listingId).trim() === '') return;
    const controller = new AbortController();
    const gen = calendarOpenFetchGenRef.current;
    const trackOpen = openCalendarRef.current && hasRangeRef.current;
    if (trackOpen) beginCalendarOpenPricingFetch(gen);
    setCalendarPricingLoading(true);
    fetchCalendarPricing(listingId, shownMonthIso, 3, controller.signal)
      .then((result) => {
        setCalendarDailyPrices((prev) => new Map([...prev, ...result.dateToPrice]));
        if (result.convenienceFeePercent != null) setCalendarConvenienceFeePercent(result.convenienceFeePercent);
        setCalendarPricingFailed(false);
      })
      .catch((error: unknown) => {
        // Fetch failure: leave any already-merged prices in place rather than clearing the
        // whole map (a transient failure for the current month shouldn't blank out prices
        // already fetched for the selected range).
        // TASK-4303: flag a genuine failure (not an unmount/StrictMode abort) so the
        // pricing-pending gate below can degrade to the fallback estimate instead of
        // holding the skeleton forever.
        if ((error as Error)?.name !== 'AbortError') setCalendarPricingFailed(true);
      })
      .finally(() => {
        setCalendarPricingLoading(false);
        if (trackOpen) endCalendarOpenPricingFetch(gen);
      });
    return () => controller.abort();
  }, [listingId, shownMonthIso]);

  // TASK-4327: when a range is selected, ensure ITS months are (re-)fetched on calendar
  // open — not just the 3 months from `shownMonthIso` (which resets to today's month on
  // every open, see the shownDate-reset effect above). Without this, a far-out selected
  // range's prices could go stale (past the 30s server cache TTL) across a close/reopen
  // with no refetch to correct them, since `shownMonthIso` may not itself change value if
  // the calendar happened to already be showing today's month before this open.
  useEffect(() => {
    if (!openCalendar) return;
    if (!listingId || String(listingId).trim() === '') return;
    if (!dateRange.startDate || !dateRange.endDate) return;
    const selectedMonthIso = toISODate(startOfMonth(dateRange.startDate));
    if (selectedMonthIso === shownMonthIso) return; // already covered by the effect above
    const controller = new AbortController();
    const gen = calendarOpenFetchGenRef.current;
    beginCalendarOpenPricingFetch(gen);
    fetchCalendarPricing(listingId, selectedMonthIso, 3, controller.signal)
      .then((result) => {
        setCalendarDailyPrices((prev) => new Map([...prev, ...result.dateToPrice]));
        if (result.convenienceFeePercent != null) setCalendarConvenienceFeePercent(result.convenienceFeePercent);
      })
      .catch(() => {
        // Leave existing prices in place; selectedRangeTotalFromCalendar's own
        // effectiveDailyPricing fallback covers a fully-failed fetch.
      })
      .finally(() => {
        endCalendarOpenPricingFetch(gen);
      });
    return () => {
      controller.abort();
    };
  }, [openCalendar, listingId, dateRange.startDate, dateRange.endDate, shownMonthIso]);

  // TASK-4303: does every night of the selected range have a REAL per-date price from the
  // pricing API? Until then, any total the widget could compute rides on the base-rate
  // fallback (no weekend uplift) with a ₹0 processing fee — the exact provisional number
  // that later "jumps" +~12% once the API resolves. Used below to hold a loading skeleton
  // instead of that misleading number.
  const selectedRangeNightsPriced = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return false;
    let d = getIstStartOfDay(dateRange.startDate);
    const end = getIstStartOfDay(dateRange.endDate);
    if (end.getTime() <= d.getTime()) return false;
    while (d.getTime() < end.getTime()) {
      if (!calendarDailyPrices.has(toISODate(d))) return false;
      d = addDays(d, 1);
    }
    return true;
  }, [dateRange.startDate, dateRange.endDate, calendarDailyPrices]);

  // TASK-4303: ensure the SELECTED range's months get fetched even when the guest never opens
  // the calendar (e.g. dates hydrated from ?checkIn=&checkOut= URL params for a range beyond
  // the mount-fetched 3-month window). Without this, such a range would previously show the
  // silent base-rate fallback total — and with the pending gate below it would instead hold
  // the skeleton forever, since no fetch would ever cover its nights.
  const selectedStartMonthIso = dateRange.startDate ? toISODate(startOfMonth(dateRange.startDate)) : null;
  useEffect(() => {
    if (!listingId || String(listingId).trim() === '') return;
    if (!selectedStartMonthIso || !dateRange.endDate) return;
    if (selectedRangeNightsPriced) return; // already covered by a prior fetch
    if (selectedStartMonthIso === shownMonthIso) return; // covered by the mount/month effect above
    const controller = new AbortController();
    fetchCalendarPricing(listingId, selectedStartMonthIso, 3, controller.signal)
      .then((result) => {
        setCalendarDailyPrices((prev) => new Map([...prev, ...result.dateToPrice]));
        if (result.convenienceFeePercent != null) setCalendarConvenienceFeePercent(result.convenienceFeePercent);
        setCalendarPricingFailed(false);
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name !== 'AbortError') setCalendarPricingFailed(true);
      });
    return () => controller.abort();
  }, [listingId, selectedStartMonthIso, dateRange.endDate, selectedRangeNightsPriced, shownMonthIso]);

  // TASK-4322: previously fetched a "LOS discount" here via the calendar breakdown client and
  // rendered it as a "Long-stay discount" row — but that value was actually the summed
  // per-day tenant GLOBAL discount (CalendarPricingDayDto has no genuine LOS field), and
  // it was being subtracted a SECOND time from `breakdownPrice` below, which is already
  // discount-net (see fetchCalendarPricing's `actualPrice = base - discount`,
  // src/api/pricingClient.ts). That double subtraction understated the displayed total
  // vs. the server's charged amount. Removed entirely until TASK-571 wires a real
  // per-day LOS field into the calendar pricing DTO — at which point this should fetch
  // and render genuine LOS data instead of re-deriving it from the global discount.

  const gstRangeStartIso = dateRange?.startDate ? toISODate(dateRange.startDate) : null;
  const gstRangeEndIso = dateRange?.endDate ? toISODate(dateRange.endDate) : null;

  // TASK-4331: fetch the server's own GST slab/amount for the selected range instead of
  // re-deriving 5%/18% client-side from a pre-adjustment per-night rate. The calendar
  // pricing endpoint (`fetchCalendarPricing`, used for `perNightForDisplay` below) only
  // knows base/weekend/override rate minus the tenant global discount — it has no idea
  // about LOS, last-minute, or min-price-floor adjustments. The server's charged GST
  // (`PricingService.GetPublicBreakdownAsync`, same call `RazorpayPaymentService` uses to
  // build the order) decides the slab from the per-night rate AFTER those adjustments.
  // Near the ₹7,500 boundary the two bases can pick different slabs, so we fetch the
  // server's real value here and prefer it; the client-derived slab below remains only as
  // a fallback while this request is in flight or if it fails.
  useEffect(() => {
    if (!listingId || String(listingId).trim() === '') {
      setServerGstPercent(null);
      setServerGstAmount(null);
      setServerFinalAmount(null);
      return;
    }
    if (!gstRangeStartIso || !gstRangeEndIso) {
      setServerGstPercent(null);
      setServerGstAmount(null);
      setServerFinalAmount(null);
      return;
    }
    const controller = new AbortController();
    fetchGuestGstBreakdown(listingId, gstRangeStartIso, gstRangeEndIso, controller.signal)
      .then((b) => {
        setServerGstPercent(b.gstPercent);
        setServerGstAmount(b.gstAmount);
        setServerFinalAmount(b.finalAmount);
      })
      .catch(() => {
        setServerGstPercent(null);
        setServerGstAmount(null);
        setServerFinalAmount(null);
      });
    return () => controller.abort();
  }, [listingId, gstRangeStartIso, gstRangeEndIso]);

  const isCheckInAllowed = (date: Date) => {
  const iso = toISODate(getIstStartOfDay(date));
  
  // Check status from dateStatusMap (from GET API response)
  const status = dateStatusMap.get(iso);
  if (status === 'Blocked' || status === 'Hold') {
    return false; // blocked/hold dates never allow check-in
  }
  
  // Also check blockedSet for backward compatibility
  if (blockedSet.has(iso)) return false; // blocked dates never check-in
  
  // Allow check-in if previous date is blocked or it's today
  const prevDayISO = toISODate(addDays(date, -1));
  const prevStatus = dateStatusMap.get(prevDayISO);
  if (prevStatus === 'Blocked' || prevStatus === 'Hold' || blockedSet.has(prevDayISO)) {
    return true;
  }
  return true; // otherwise normal
};

  const disabledDay = useCallback((date: Date) => {
  const normalized = getIstStartOfDay(date);

  // Disable past dates
  if (normalized.getTime() < today.getTime()) return true;

  const iso = toISODate(normalized);

  // Get status from dateStatusMap (from GET API response)
  const status = dateStatusMap.get(iso);
  const isBlockedOrHold = status === 'Blocked' || status === 'Hold' || blockedSet.has(iso);

  if (!isBlockedOrHold) {
    return false; // all other dates are selectable
  }

  // TASK-4326: checkout is exclusive — a candidate date blocked by the NEXT booking (or a
  // hold) is still a valid CHECKOUT as long as every NIGHT strictly between startDate and
  // the candidate is free (doesRangeIntersectBlocked treats [checkIn, checkOut) correctly).
  // The old rule only exempted candidate === startDate+1, so any back-to-back stay longer
  // than 1 night (e.g. check-in D-2, blocked date D as checkout, nights D-2/D-1 free) was
  // unbookable even though the validator in handleRangeChange already accepts it. Still
  // disabled as a CHECK-IN date — this only exempts candidates that could be a checkout for
  // the currently-selected startDate.
  if (dateRange.startDate && normalized.getTime() > getIstStartOfDay(dateRange.startDate).getTime()) {
    const startISO = toISODate(getIstStartOfDay(dateRange.startDate));
    if (!doesRangeIntersectBlocked(startISO, iso, blockedSet)) {
      return false; // valid checkout — nights in between are all free
    }
  }

  return true; // disable blocked/hold dates otherwise (including as a check-in candidate)
}, [blockedSet, dateStatusMap, today, dateRange.startDate]);

// Helper function to check if a date range has interior-night overlaps with blocked/hold dates.
// Used by URL hydration, handleRangeChange, and handleReserve to ensure consistent validation.
const checkInteriorNightOverlap = (startDate: Date, endDate: Date): boolean => {
  const startIST = getIstStartOfDay(startDate);
  const endIST = getIstStartOfDay(endDate);

  let cursor = startIST;
  while (cursor.getTime() < endIST.getTime()) {
    const dayISO = toISODate(cursor);
    const status = dateStatusMap.get(dayISO);
    if (blockedSet.has(dayISO) || status === 'Blocked' || status === 'Hold') {
      return true;
    }
    // TASK-4628: re-normalize each step to IST start-of-day, matching the canonical
    // doesRangeIntersectBlocked/expandBookingsToBlockedSet iterators (dateRange.ts). A bare
    // addDays preserves the runtime-local wall-clock, so across a DST/offset boundary the
    // iterated dayISO can drift off the IST calendar day and MISS the occupied night — even
    // though the calendar's per-cell disabledDay (which derives each ISO directly) still
    // paints it .bc-unavail. That divergence is why the E13 overlap-block message fired
    // locally (fixed-offset gate TZ) but not on remote dev (E13 seeds the occupied night one
    // month out). Re-normalizing keeps the overlap check's per-night ISOs in lockstep with
    // the calendar's block rendering.
    cursor = getIstStartOfDay(addDays(cursor, 1));
  }
  return false;
};

const handleRangeChange = (next: AtlasDateRangePickerValue) => {
  setDateError(null);
  const { startDate, endDate } = next;

  if (!startDate) {
    setDateRange(next);
    return;
  }

  // First click → start date
  if (!endDate) {
    // Prevent selecting blocked date as check-in
    if (!isCheckInAllowed(startDate)) {
      setDateError('This date cannot be a check-in.');
      return;
    }
    setDateRange({ startDate, endDate: null });
    return;
  }

  const startIST = getIstStartOfDay(startDate);
  const endIST = getIstStartOfDay(endDate);
  if (endIST.getTime() <= startIST.getTime()) {
    setDateError('Check-out must be after check-in.');
    return;
  }

  const selectedNights = Math.round((endIST.getTime() - startIST.getTime()) / 86400000);
  if (minStayNights > 1 && selectedNights < minStayNights) {
    setDateError(`Minimum stay is ${minStayNights} nights.`);
    return;
  }

  if (minAdvanceDays > 0) {
    const minCheckin = addDays(getIstStartOfDay(new Date()), minAdvanceDays);
    if (startIST < minCheckin) {
      setDateError(`This listing requires at least ${minAdvanceDays} day${minAdvanceDays !== 1 ? 's' : ''} advance notice.`);
      return;
    }
  }

  // Check if range overlaps with any blocked/hold dates from either blockedSet or dateStatusMap.
  // dateStatusMap is the source of truth from the availability API, while blockedSet is a
  // cached set for performance. We must check both to catch dates that the API marks as
  // Blocked/Hold but haven't been added to blockedSet (e.g., new blocks created mid-session).
  const hasOverlap = checkInteriorNightOverlap(startIST, endIST);

  if (hasOverlap) {
    // Exception: allow single-day checkout if blocked/hold (check-out on blocked/hold date is allowed)
    const prevDay = addDays(startDate, 1);
    const endISOForCheck = toISODate(endDate);
    if (
      endDate.getTime() === prevDay.getTime() &&
      (blockedSet.has(endISOForCheck) || dateStatusMap.get(endISOForCheck) === 'Blocked' || dateStatusMap.get(endISOForCheck) === 'Hold')
    ) {
      setDateRange({ startDate, endDate });
      // Auto-close calendar when both dates are selected
      setOpenCalendar(false);
      return;
    }
    setDateError('These dates overlap an existing booking or hold.');
    return;
  }

  setDateRange(next);
  // Auto-close calendar when both dates are selected
  setOpenCalendar(false);
  // TASK-1480: funnel event when both dates are selected
  if (next.startDate && next.endDate && listingId != null) {
    track('select_dates', Number(listingId));
  }
};


  const calculatePrice = () => {
    const unitType = inferUnitType({ id: propertyId, property_name: listingName });
    const includedGuests = 2;
    
    // Nights: IST-normalized; 0 if partial range or same-day / invalid (never default to 1 — that enabled submit on bad state).
    const nights =
      dateRange.startDate && dateRange.endDate
        ? (() => {
            const s = getIstStartOfDay(dateRange.startDate);
            const e = getIstStartOfDay(dateRange.endDate);
            if (e.getTime() <= s.getTime()) return 0;
            return calculateNights(s, e);
          })()
        : 0;
    
    // Calculate extra guests
    const extraGuests = Math.max(0, guests - includedGuests);
    
    // Calculate pricing using the utility function for a single night
    const {
      baseNightlyPrice,
      finalNightlyPrice,
      extraGuestFee,
      appliedDiscountPercent,
      hasSpecialDateMultiplier
    } = calculateNightlyPrice({
      unitType,
      checkInDate: dateRange.startDate || new Date(),
      guests: guests || includedGuests
    });
    
    // Calculate totals for the entire stay
    const basePrice = baseNightlyPrice * nights;
    const total = finalNightlyPrice * nights;
    const extraGuestsFee = extraGuestFee * nights;
    const subtotal = basePrice + extraGuestsFee;
    const discount = appliedDiscountPercent > 0 ? (subtotal * appliedDiscountPercent) / 100 : 0;
    
    return {
      basePrice,
      extraGuestsFee,
      subtotal,
      discount: Math.round(discount),
      total: Math.round(total),
      nights,
      extraGuests,
      hasSpecialDateMultiplier,
      appliedDiscountPercent,
    };
  };

  const priceDetails = calculatePrice();

  const invalidIstStayRange = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return false;
    const s = getIstStartOfDay(dateRange.startDate).getTime();
    const e = getIstStartOfDay(dateRange.endDate).getTime();
    if (e <= s) return true;
    // TASK-4285: a past-dated check-in (e.g. via URL params) is never bookable — disable Reserve
    // and suppress the price breakdown just as for an inverted range.
    if (s < today.getTime()) return true;
    return false;
  }, [dateRange.startDate, dateRange.endDate, today]);

  // TASK-4293: the selected check-in day is itself Blocked/Hold (turnover/cleaning window or an
  // explicit block). handleReserve already refuses these (formError), but that only fires AFTER a
  // click — mirror the same check reactively so the Reserve button can be disabled up front and the
  // guest gets clear prevention instead of a confusing post-click failure. Only needs startDate
  // (the check-in day itself is unavailable regardless of checkout); blank dates stay clickable
  // (TASK-4277) because this is false without a startDate.
  const checkinUnavailable = useMemo(() => {
    if (!dateRange.startDate) return false;
    const checkinISO = toISODate(getIstStartOfDay(dateRange.startDate));
    const checkinStatus = dateStatusMap.get(checkinISO);
    return checkinStatus === 'Blocked' || checkinStatus === 'Hold' || blockedSet.has(checkinISO);
  }, [dateRange.startDate, dateStatusMap, blockedSet]);

  // TASK-4334/TASK-4405: recompute the free-cancellation deadline whenever the guest's selected
  // check-in date, the listing's resolved cancellation tier, or the resolved grace hours changes.
  // Uses "now" as the booking-time estimate (the actual booking doesn't exist yet at this stage) —
  // same estimate posture the tier-only deadline already used pre-booking.
  const cancellationDeadlineText = useMemo(() => {
    if (!dateRange.startDate) return null;
    const deadline = resolvedGraceHours
      ? computeEffectiveCancellationDeadline(
          dateRange.startDate, resolvedCancellationTier, resolvedCancellationWindowHours, new Date(), resolvedGraceHours)
      : computeCancellationDeadline(dateRange.startDate, resolvedCancellationTier, resolvedCancellationWindowHours);
    return formatCancellationDeadline(deadline);
  }, [dateRange.startDate, resolvedCancellationTier, resolvedCancellationWindowHours, resolvedGraceHours]);

  const { loading: dailyPricingLoading, error: _dailyPricingError, getListingPricing } = useDailyPricingSummary();
  const dailyPricing = useMemo(
    () => (listingId != null && String(listingId).trim() !== '' ? getListingPricing(listingId) : null),
    [listingId, getListingPricing],
  );

  /** When API has loaded, use its price (including 0). When API has not loaded or failed, we show 0. */
  const effectiveDailyPricing = dailyPricing;

  /** Sum of calendar daily prices for the selected date range (same as shown in calendar). */
  const selectedRangeTotalFromCalendar = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return null;
    let total = 0;
    let d = getIstStartOfDay(dateRange.startDate);
    const end = getIstStartOfDay(dateRange.endDate);
    while (d.getTime() < end.getTime()) {
      const iso = toISODate(d);
      const price = calendarDailyPrices.get(iso) ?? effectiveDailyPricing?.actualPrice ?? 0;
      total += price;
      d = addDays(d, 1);
    }
    return Math.round(total);
  }, [dateRange.startDate, dateRange.endDate, calendarDailyPrices, effectiveDailyPricing?.actualPrice]);

  // ---------- Fee calculations ----------

  // TASK-1645 / TASK-2870: Indian accommodation GST slab (5% ≤₹7,500/night, 18% above).
  // Room fare in breakdown is GST-exclusive base; GST is additive for transparency.

  // When API has loaded: use API price (or calendar sum). When API has not loaded: use 0.
  const hasSelectedRange = Boolean(dateRange.startDate && dateRange.endDate);

  // TASK-4303: per-date pricing + fee percent for the selected range are still resolving.
  // While pending, the headline total and price breakdown render a loading skeleton instead
  // of the provisional base-rate/₹0-fee number that would otherwise silently jump ~12% once
  // the pricing API responds. Only a terminal fetch failure degrades to the old fallback
  // estimate (graceful offline UX) — matching the widget's existing degradation pattern.
  const rangePricingPending =
    hasSelectedRange && !invalidIstStayRange && !selectedRangeNightsPriced && !calendarPricingFailed;
  const breakdownPrice =
    hasSelectedRange && selectedRangeTotalFromCalendar != null
      ? selectedRangeTotalFromCalendar
      : effectiveDailyPricing != null
        ? Math.round(effectiveDailyPricing.actualPrice * (hasSelectedRange ? priceDetails.nights : 1))
        : 0;
  const convenienceFeePercent = calendarConvenienceFeePercent != null ? calendarConvenienceFeePercent / 100 : 0;

  // Per-night: when API has loaded use API/calendar data; when API not loaded show 0.
  const perNightForDisplay =
    hasSelectedRange && selectedRangeTotalFromCalendar != null && priceDetails.nights > 0
      ? Math.round(selectedRangeTotalFromCalendar / priceDetails.nights)
      : effectiveDailyPricing != null
        ? effectiveDailyPricing.actualPrice
        : 0;

  // TASK-4331: does the in-flight/loaded server GST fetch match the CURRENTLY selected range?
  // Guards against a stale serverGstPercent (from a prior selection) being applied to a new
  // one for one render before the effect above re-fires.
  const serverGstMatchesSelection =
    hasSelectedRange && gstRangeStartIso === toISODate(dateRange.startDate!) && gstRangeEndIso === toISODate(dateRange.endDate!);

  /**
   * TASK-4331: GST slab basis divergence fix. The client-derived slab below (from
   * `perNightForDisplay`) uses the calendar endpoint's rate — base/weekend/override MINUS
   * global discount only, with NO knowledge of LOS/last-minute/min-price-floor adjustments.
   * The server (`PricingService.GetPublicBreakdownAsync`, PricingService.cs:137-145) decides
   * the slab from the per-night rate AFTER those adjustments — the SAME computation
   * `RazorpayPaymentService` uses to build the actual charged order. Near the ₹7,500/night
   * boundary the two bases can disagree (e.g. a 10% LOS discount can push a ₹8,000 listing's
   * effective per-night below ₹7,500, flipping 18%→5%). Prefer the server's own computed
   * gstPercent/gstAmount (fetched via fetchGuestGstBreakdown) whenever it has loaded for the
   * current selection — single source of truth, matches what gets charged. Fall back to the
   * client-derived slab only while that fetch is in flight or has failed (loading/offline UX),
   * consistent with the widget's existing graceful-degradation pattern.
   */
  const gstSlabPercent =
    serverGstMatchesSelection && serverGstPercent != null
      ? serverGstPercent
      : hasSelectedRange && perNightForDisplay > 0
        ? accommodationGstSlabPercent(perNightForDisplay)
        : null;

  /**
   * GST component of room fare (ADDITIVE — CPO formula per 2026-05-21).
   * TASK-4322: `breakdownPrice` (from selectedRangeTotalFromCalendar / effectiveDailyPricing.actualPrice)
   * is ALREADY discount-net — the tenant global discount is netted in server-side per-day
   * `actualPrice = base - discount` (src/api/pricingClient.ts). A second subtraction here
   * (previously via a mislabeled "LOS discount") double-counted the same discount and
   * understated the total vs. what the server actually charges. taxableBase == breakdownPrice.
   * Real TASK-571 LOS discounts are not exposed by the calendar pricing DTO today, so there
   * is nothing genuine left to subtract; when that DTO gains a real per-day LOS field, apply
   * it here (once) instead of re-deriving it from the discount already netted into the price.
   */
  const taxableBase = Math.max(0, breakdownPrice);
  // TASK-4331: prefer the server's own computed GST amount (already rounded server-side on
  // its own post-adjustment base) over recomputing from the (possibly divergent) taxableBase.
  const gstLineAmount =
    serverGstMatchesSelection && serverGstAmount != null
      ? serverGstAmount
      : gstSlabPercent != null && taxableBase > 0
        ? accommodationGstLineAmount(taxableBase, perNightForDisplay)
        : 0;

  // TASK-4913 (founder-ruled 2026-07-17, option c): the 3% "Payment processing" fee is charged
  // on the BASE accommodation amount only — NOT on base+GST. Supersedes the prior base+GST rule
  // (memory: project_guest_booking_pricing_formula) which overcharged guests relative to the
  // "no guest service fee / save vs OTA" booking-card copy. Mirrors PricingService.BuildBreakdown.
  const breakdownConvenienceFee = Math.round(taxableBase * convenienceFeePercent);

  // TASK-4322: Total = discount-net base + GST + Service Fee (canonical formula).
  // Offline fallback only — TASK-5184 prefers server FinalAmount (includes tourist tax).
  const breakdownFinalTotal = Math.max(1, taxableBase + gstLineAmount + breakdownConvenienceFee);

  const finalTotal =
    serverGstMatchesSelection && typeof serverFinalAmount === 'number' && serverFinalAmount > 0
      ? serverFinalAmount
      : hasSelectedRange && selectedRangeTotalFromCalendar != null
        ? breakdownFinalTotal
        : effectiveDailyPricing != null
          ? breakdownFinalTotal
          : 0;

  // TASK-4629: keep last settled headline; while calendar-open pricing refetch is pending,
  // never expose a lower recomputed total (fee/GST flash under F1).
  useEffect(() => {
    if (!calendarOpenPricingPending && hasSelectedRange && finalTotal > 1) {
      lastSettledHeadlineRef.current = finalTotal;
    }
  }, [calendarOpenPricingPending, hasSelectedRange, finalTotal]);

  const displayFinalTotal =
    calendarOpenPricingPending && lastSettledHeadlineRef.current > 1
      ? lastSettledHeadlineRef.current
      : finalTotal;

  /** Format price; show ₹0 when 0 (e.g. when API not loaded or API returned 0). */
  const displayPrice = (n: number) =>
    formatCurrency(n, { maximumFractionDigits: 0 });

  const convenienceFeePctLabel = Math.round(convenienceFeePercent * 100);
  const referralDiscountApplied = 0;
  const promoDiscountApplied = 0;
  const addOnsTotal = 0;

  // v2: "Why book direct" block removed from widget JSX. Calculation kept (prefixed _) for future
  // OTA comparison card on the listing page. TASK-2576 context: data was used to show OTA fee delta.
  const illustrativeOtaGuestFeeComparison = useMemo(() => {
    if (!hasSelectedRange || breakdownPrice <= 0) return null;
    const illustrativeGuestFee = Math.round((breakdownPrice * ILLUSTRATIVE_OTA_GUEST_FEE_PERCENT) / 100);
    return {
      illustrativeGuestFee,
      illustrativeRoomPlusFee: breakdownPrice + illustrativeGuestFee,
    };
  }, [hasSelectedRange, breakdownPrice]);

  // v2 date display uses split check-in/check-out cells (see lv-date-cell blocks below).

  // TASK-2612: handleReserve replaces the old handleSubmit.
  // Calls init-hold mode (GuestInfo absent), stores holdId+holdExpiresAt in context, navigates to details page.
  const handleReserve = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isBookingDisabled) {
      setFormError('Service temporarily unavailable. Please try again later.');
      return;
    }
    // TASK-4830: defense-in-depth — the Reserve button is disabled while availability failed,
    // but a form submit (e.g. Enter key) could still invoke this. Refuse to create a hold when
    // we could not confirm availability, since dateStatusMap/blockedSet are empty (fail-closed).
    if (availabilityFailed) {
      setFormError('We couldn’t confirm availability for these dates. Please retry checking availability before reserving.');
      return;
    }
    setDateError(null);
    setFormError(null);

    // Date validation
    // TASK-4911: distinguish which field is actually missing (instead of a generic "select
    // both dates" message) and move focus there, so the guest isn't left guessing why Reserve
    // didn't proceed.
    if (!dateRange.startDate || !dateRange.endDate) {
      const message = !dateRange.startDate
        ? 'Add a check-in date to continue.'
        : 'Add a check-out date to continue.';
      setDateError(message);
      if (!dateRange.startDate) {
        calendarButtonRef.current?.focus();
      } else {
        checkoutCellRef.current?.focus();
      }
      return;
    }
    const checkinIst = getIstStartOfDay(dateRange.startDate);
    const checkoutIst = getIstStartOfDay(dateRange.endDate);
    if (checkoutIst.getTime() <= checkinIst.getTime()) {
      setDateError('Check-out must be after check-in.');
      return;
    }
    // TASK-4285: defense-in-depth — never create a hold for a past-dated check-in, even if the
    // dates arrived via URL params and bypassed the calendar's disabled-day guard.
    if (checkinIst.getTime() < today.getTime()) {
      setDateError('Check-in date must be today or in the future.');
      return;
    }
    const stayNights = calculateNights(checkinIst, checkoutIst);
    if (stayNights < 1) {
      setDateError('Check-out must be after check-in.');
      return;
    }
    // TASK-4556: enforce min-stay on handleReserve (like handleRangeChange does)
    if (minStayNights > 1 && stayNights < minStayNights) {
      setDateError(`Minimum stay is ${minStayNights} nights.`);
      return;
    }

    const checkinISO = toISODate(checkinIst);
    const checkinStatus = dateStatusMap.get(checkinISO);
    if (checkinStatus === 'Blocked' || checkinStatus === 'Hold' || blockedSet.has(checkinISO)) {
      setFormError('Check-in date is not available. Please select a different check-in date.');
      return;
    }

    // TASK-4726: check interior-night overlaps in handleReserve (like handleRangeChange does)
    if (checkInteriorNightOverlap(checkinIst, checkoutIst)) {
      setDateError('These dates overlap an existing booking or hold.');
      return;
    }

    const numericListingId = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(numericListingId)) {
      setFormError('Property could not be loaded. Please refresh the page and try again.');
      return;
    }

    // TASK-2879: never create a hold without route slugs — /reserve cannot carry holdId forward.
    const targetSlug = (propertySlug ?? '').trim();
    const targetUnit = (unitSlug ?? '').trim();
    if (!targetSlug || !targetUnit) {
      setFormError(
        'Checkout is temporarily unavailable for this listing. Please refresh the page or contact the host.',
      );
      return;
    }

    let orderUrl: string;
    try {
      orderUrl = buildApiUrl('/api/Razorpay/order');
    } catch {
      setFormError('Unable to start checkout. Please try again later.');
      return;
    }

    setIsSubmitting(true);
    track('start_checkout', numericListingId);

    try {
      const orderPayload = {
        bookingDraft: {
          listingId: numericListingId,
          checkinDate: toISODate(checkinIst),
          checkoutDate: toISODate(checkoutIst),
          guests,
        },
        currency: 'INR',
        // GuestInfo absent — init-hold mode
        guestConsentAccepted: false,
      };

      const idempotencyKey = crypto.randomUUID();
      const response = await axios.post(orderUrl, orderPayload, {
        headers: getOrderRequestHeaders(idempotencyKey),
        timeout: 15000,
      });

      // TASK-4111: read server-authoritative breakdown so GuestDetailsPage renders
      // the correct quote on first paint. Fall back to client sums when absent.
      const {
        holdId,
        holdExpiresAt,
        prepToken,
        baseAmount: serverBaseAmount,
        convenienceFeeAmount: serverConvFee,
        finalAmount: serverFinalAmount,
      } = response.data ?? {};
      if (!holdId || !holdExpiresAt) {
        throw new Error('Hold could not be created. Please try again.');
      }

      // Store hold state in context and navigate to details page
      updateBooking({
        holdId: Number(holdId),
        // TASK-4354: keep the hold ownership token so the final-charge call can prove it owns the hold.
        holdToken: typeof prepToken === 'string' ? prepToken : null,
        holdExpiresAt: typeof holdExpiresAt === 'string' ? holdExpiresAt : new Date(holdExpiresAt).toISOString(),
        holdPropertySlug: propertySlug ?? null,
        holdUnitSlug: unitSlug ?? null,
        holdListingId: numericListingId,
        holdListingName: listingName ?? null,
        holdPriceBreakdown: {
          baseAmount: typeof serverBaseAmount === 'number' && serverBaseAmount > 0 ? serverBaseAmount : breakdownPrice,
          discountAmount: 0,
          // TASK-4286: only trust server convenienceFeeAmount when it is a positive number.
          // The init-hold mode API returns convenienceFeeAmount=0 (a valid JS number) when
          // it doesn't compute the fee, which caused the checkout page to show ₹0 processing
          // fee and a total ₹378 lower than the listing widget. Fall back to the client-computed
          // breakdownConvenienceFee so both surfaces agree.
          convenienceFeeAmount: typeof serverConvFee === 'number' && serverConvFee > 0 ? serverConvFee : breakdownConvenienceFee,
          finalAmount: typeof serverFinalAmount === 'number' && serverFinalAmount > 0 ? serverFinalAmount : (finalTotal > 0 ? finalTotal : breakdownFinalTotal),
          nights: stayNights,
          currency: 'INR',
        },
        // Forward dates/guests into context for the details page
        checkIn: checkinIst.toISOString(),
        checkOut: checkoutIst.toISOString(),
        guests,
      });

      navigate(`/book/${targetSlug}/${targetUnit}/details`);
    } catch (error: unknown) {
      console.error('[UnitBookingWidget] Reserve error:', error);
      const data = (error as { response?: { data?: { code?: string; Code?: string } } })?.response?.data;
      const code = (typeof data?.code === 'string' ? data.code : typeof data?.Code === 'string' ? data.Code : '') || '';
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 503 && code === 'PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM') {
        setProviderBlocked(true);
      } else {
        setFormError(getBookingErrorMessage(error, 'order'));
        // AVAILABILITY_CONFLICT (409): the dates were just taken by another in-flight checkout.
        // Force-refresh the calendar so the now-unavailable dates show as blocked and the guest
        // isn't re-picking the same taken dates from a stale calendar.
        if (status === 409 || code === 'AVAILABILITY_CONFLICT') {
          lastAvailabilityKeyRef.current = null;
          setAvailabilityRefreshNonce((n) => n + 1);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting, isBookingDisabled, availabilityFailed, dateRange, dateStatusMap, blockedSet, today,
    listingId, guests, propertySlug, unitSlug, listingName, breakdownPrice, breakdownConvenienceFee,
    breakdownFinalTotal, finalTotal, updateBooking, navigate,
  ]);

  if (providerBlocked) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-8 text-center space-y-3" data-testid="provider-blocked-banner">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-semibold text-text-primary">Bookings opening soon</h2>
        <p className="text-sm text-text-secondary">
          Online booking is temporarily unavailable for this property. Please contact the host directly to make a reservation.
        </p>
      </div>
    );
  }

  return (
    // TASK-2612: fragment wrapper intentional — avoids extra DOM nesting
    <>
      <form id="booking-form" onSubmit={handleReserve} className="lv-booking" role="region" aria-label="Booking and availability" data-testid="guest-booking-form">

      {/* v2 block (1): Price headline */}
      <div className="lv-booking-headline" data-testid="bw-header">
        {/* TASK-4303: while per-date pricing resolves, show a skeleton — never the provisional
            base-rate total that silently jumps once the API responds. */}
        {hasSelectedRange && !invalidIstStayRange && rangePricingPending ? (
          <>
            <div className="lv-booking-total" data-testid="bw-price-pending" aria-busy="true">
              <span
                className="inline-block h-6 w-24 animate-pulse rounded bg-[#f0e6dc] align-middle"
                aria-hidden="true"
              />
              <span>total · {priceDetails.nights} {priceDetails.nights === 1 ? 'night' : 'nights'}</span>
            </div>
            <p className="lv-booking-sub" role="status">Fetching latest prices…</p>
          </>
        ) : hasSelectedRange && !invalidIstStayRange && calendarPricingFailed ? (
          <>
            <div className="lv-booking-total">
              <span className="text-sm text-text-warning" data-testid="bw-pricing-error">
                Couldn't load prices
              </span>
            </div>
            <p className="lv-booking-sub">Please try selecting dates again</p>
          </>
        ) : hasSelectedRange && !invalidIstStayRange && displayFinalTotal > 0 ? (
          <>
            <div className="lv-booking-total">
              <b data-testid="bw-per-night-price">{displayPrice(displayFinalTotal)}</b>
              <span>total · {priceDetails.nights} {priceDetails.nights === 1 ? 'night' : 'nights'}</span>
            </div>
            <p className="lv-booking-sub">
              {dateRange.startDate && dateRange.endDate
                ? `${format(dateRange.startDate, 'dd MMM')} — ${format(dateRange.endDate, 'dd MMM')} · all fees included`
                : 'all fees included'}
            </p>
          </>
        ) : (
          <>
            <div className="lv-booking-total">
              <span className="lv-booking-from-prefix">From </span>
              <b data-testid="bw-per-night-price">
                {hasSelectedRange && perNightForDisplay > 0
                  ? formatCurrency(perNightForDisplay, { maximumFractionDigits: 0 })
                  : effectiveDailyPricing != null
                    ? formatCurrency(effectiveDailyPricing.actualPrice, { maximumFractionDigits: 0 })
                    : perNightForDisplay > 0
                      ? formatCurrency(perNightForDisplay, { maximumFractionDigits: 0 })
                      : '—'}
              </b>
              <span> / night</span>
            </div>
            <p className="lv-booking-sub">Select dates to see total price</p>
          </>
        )}
        {reviewCount != null && reviewCount > 0 && reviewRating != null && (
          <div className="bw-rating" data-testid="bw-rating-block" style={{ marginTop: 6 }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#c45a3f" aria-hidden="true">
              <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7.3-6.2-3.8-6.2 3.8 1.6-7.3L2 9.5l7.1-.6L12 2z"/>
            </svg>
            <span className="bw-rating-num">{reviewRating.toFixed(1)}</span>
            <span className="bw-rating-sep" aria-hidden="true">·</span>
            <span className="bw-rating-link">{reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}</span>
          </div>
        )}
      </div>

      {displayCoverUrl && (
        <div className="overflow-hidden rounded-xl border border-border-subtle mb-2" style={{ marginTop: -4 }}>
          <OptimizedImage
            src={displayCoverUrl}
            alt={listingName ? `${listingName} — preview` : 'Listing preview'}
            className="w-full h-36 sm:h-40 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {listingId != null && Number(listingId) > 0 && (
        <FomoBar listingId={Number(listingId)} />
      )}
      {isBookingDisabled && (
        <ErrorBanner className="mt-2" message="Service temporarily unavailable. Booking will return soon." />
      )}

      {/* v2: "Why book direct" info collapsed — illustrativeOtaGuestFeeComparison kept for outer page
          comparison card usage. Reference kept alive by the calculation above (line ~870). */}
      {/* Price loading state — shown inline in breakdown when loading */}
      {dailyPricingLoading && (
        <p className="text-xs text-text-muted" style={{ marginTop: 4 }}>Loading price…</p>
      )}

      {/* v2 block (2) + (3): Date range card + Guests card */}
      <div className="lv-booking-form">
        {minStayNights > 1 && (
          <p
            className="inline-flex items-center rounded-full bg-[#ffe4d6] px-3 py-1.5 text-sm font-medium text-[#4a3535] border border-[#e5cfc0]"
            style={{ marginBottom: 8 }}
            data-testid="min-stay-badge"
          >
            Minimum {minStayNights} night{minStayNights !== 1 ? 's' : ''}
          </p>
        )}
        {/* v2 date card */}
        <div
          className="lv-date-pair"
          role="group"
          aria-label="Check-in and check-out dates"
        >
          <button
            id="unit-booking-dates"
            ref={calendarButtonRef}
            type="button"
            className="lv-date-cell"
            aria-label="Select check-in date"
            aria-describedby={dateError ? dateErrorId : undefined}
            aria-invalid={dateError ? true : undefined}
            disabled={isBookingDisabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isBookingDisabled) return;
              setOpenCalendar(true);
            }}
          >
            <small>Check-in</small>
            {dateRange.startDate
              ? <div className="lv-date-val">{timezoneId ? formatDateInTimezone(dateRange.startDate, timezoneId) : format(dateRange.startDate, 'EEE dd MMM')}</div>
              : <div className="lv-date-placeholder">Add date</div>
            }
          </button>
          <button
            ref={checkoutCellRef}
            type="button"
            className="lv-date-cell"
            aria-label="Select check-out date"
            aria-describedby={dateError ? dateErrorId : undefined}
            aria-invalid={dateError ? true : undefined}
            disabled={isBookingDisabled}
            data-testid="unit-booking-checkout-cell"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isBookingDisabled) return;
              setOpenCalendar(true);
            }}
          >
            <small>Check-out</small>
            {dateRange.endDate
              ? <div className="lv-date-val">{timezoneId ? formatDateInTimezone(dateRange.endDate, timezoneId) : format(dateRange.endDate, 'EEE dd MMM')}</div>
              : <div className="lv-date-placeholder">Add date</div>
            }
          </button>
        </div>
        <AtlasBookingCalendar
            anchorRef={calendarButtonRef}
            open={openCalendar}
            onClose={() => setOpenCalendar(false)}
            value={dateRange}
            onChange={handleRangeChange}
            today={today}
            minDate={addDays(today, Math.max(-1, minAdvanceDays - 1))}
            maxDate={maxBookingDate}
            disabledDay={disabledDay}
            dateStatusMap={dateStatusMap}
            calendarDailyPrices={calendarDailyPrices}
            fallbackPrice={effectiveDailyPricing?.actualPrice ?? null}
            pricingLoading={calendarPricingLoading}
            shownDate={shownDate}
            onShownDateChange={(date) => {
              const nextShownDate = startOfMonth(date);
              if (
                shownDate.getFullYear() === nextShownDate.getFullYear() &&
                shownDate.getMonth() === nextShownDate.getMonth()
              ) {
                return;
              }
              setShownDate(nextShownDate);
            }}
          />
        {/* Incomplete date hint */}
        {dateRange.startDate && !dateRange.endDate && (
          <p
            role="status"
            data-testid="guest-booking-incomplete-dates"
            className="text-xs text-text-secondary"
            style={{ marginTop: 4 }}
          >
            Select your check-out date (minimum one night after check-in).
          </p>
        )}
        {/* Legend for calendar cell colours */}
        <p className="text-xs text-text-secondary" style={{ marginTop: 6, lineHeight: 1.5 }}>
          <span className="mr-1 inline-block rounded bg-[#ffe4d6]/60 px-1.5 py-0.5 text-[color:var(--accent-text,#a84832)]">Available</span>
          open for booking.
          <span className="mx-1 inline-block rounded bg-[#ffe4d6] px-1.5 py-0.5 text-[#4a3535]">Turnover</span>
          cleaning window (still bookable).
          <span
            className="mx-1 inline-block rounded px-1.5 py-0.5 text-[#6b5a55]"
            style={{
              background:
                'repeating-linear-gradient(-45deg, #f5ebe0, #f5ebe0 3px, #ecdfd2 3px, #ecdfd2 6px)',
            }}
          >
            Unavailable
          </span>
          booked, blocked, or on hold.
        </p>

        {/* v2 guests card */}
        <div className="lv-guest-cell bw-guests" style={{ marginTop: 0 }}>
          <button
            type="button"
            id="unit-booking-guests"
            className="bw-guests-trigger"
            style={{ padding: 0, background: 'transparent', border: 0, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            aria-label={`Guests: ${guests} ${guests === 1 ? 'guest' : 'guests'}. Click to change.`}
            onClick={(e) => { e.stopPropagation(); setGuestsOpen((o) => !o); }}
          >
            <div>
              <small style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted, #6b5a55)', marginBottom: 4 }}>Guests</small>
              <span className="lv-guest-val">{guests} {guests === 1 ? 'adult' : 'adults'}</span>
              {guests >= effectiveMaxGuests && (
                <small style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted, #6b5a55)', marginTop: 2 }}>
                  Maximum {effectiveMaxGuests} guest{effectiveMaxGuests === 1 ? '' : 's'} for this home
                </small>
              )}
            </div>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-muted, #6b5a55)', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {guestsOpen && (
            <div className="bw-guests-pop" role="group" aria-label="Guest count">
              <div className="bw-guest-row">
                <div>
                  <div className="bw-guest-label">Guests</div>
                  <div className="bw-guest-sub">
                    Ages 2+ · Maximum {effectiveMaxGuests} guest{effectiveMaxGuests === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="bw-counter">
                  <button
                    type="button"
                    className="bw-counter-btn"
                    aria-label="Decrease guests"
                    disabled={guests <= 1}
                    onClick={() => setGuests((current) => Math.max(1, current - 1))}
                  >−</button>
                  <span className="bw-counter-val">{guests}</span>
                  <button
                    type="button"
                    className="bw-counter-btn"
                    aria-label="Increase guests"
                    disabled={guests >= effectiveMaxGuests}
                    onClick={() => setGuests((current) => Math.min(effectiveMaxGuests, current + 1))}
                  >+</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* v2 block (4): Price breakdown — hidden until both dates are selected (TASK-4276)
            AND the range is valid (checkout > checkin) (TASK-4284).
            Showing a breakdown for a reversed or same-day range would display either a
            missing-GST or ₹1 total, misleading the guest.
            TASK-4303: also held behind a skeleton until per-date pricing + fee percent have
            resolved — the provisional breakdown (base rate × nights, ₹0 processing fee) read
            ~12% below the settled total and silently jumped once the API responded. */}
        {hasSelectedRange && !invalidIstStayRange && rangePricingPending && (
          <div className="lv-price-rows" data-testid="bw-breakdown-pending" aria-busy="true" role="status">
            <div className="lv-price-row">
              <span className="inline-block h-4 w-32 animate-pulse rounded bg-[#f0e6dc]" aria-hidden="true" />
              <span className="lv-num inline-block h-4 w-16 animate-pulse rounded bg-[#f0e6dc]" aria-hidden="true" />
            </div>
            <div className="lv-price-row">
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-[#f0e6dc]" aria-hidden="true" />
              <span className="lv-num inline-block h-4 w-12 animate-pulse rounded bg-[#f0e6dc]" aria-hidden="true" />
            </div>
            <p className="text-xs text-text-muted" style={{ marginTop: 4 }}>Fetching latest prices…</p>
          </div>
        )}
        {hasSelectedRange && !invalidIstStayRange && !rangePricingPending && (
        <div className="lv-price-rows">
          {/* TASK-4282: Show per-night breakdown when rates vary, or averaged format when uniform */}
          {(() => {
            // Collect daily prices for the selected range
            const dailyPrices: { date: string; price: number }[] = [];
            if (dateRange.startDate && dateRange.endDate) {
              let d = getIstStartOfDay(dateRange.startDate);
              const end = getIstStartOfDay(dateRange.endDate);
              while (d.getTime() < end.getTime()) {
                const iso = toISODate(d);
                const price = calendarDailyPrices.get(iso) ?? effectiveDailyPricing?.actualPrice ?? 0;
                dailyPrices.push({ date: iso, price });
                d = addDays(d, 1);
              }
            }

            // Check if rates vary
            const uniquePrices = new Set(dailyPrices.map(dp => dp.price));
            const ratesVary = uniquePrices.size > 1;

            if (ratesVary && dailyPrices.length > 0) {
              // Show per-night breakdown
              return (
                <>
                  {dailyPrices.map((dp, idx) => {
                    const formatted = formatIsoDateInTimezone(dp.date, 'EEE d MMM', timezoneId);
                    const parts = formatted.split(' ');
                    const dayName = parts[0];
                    const dateNum = parts.slice(1).join(' ');
                    return (
                      <div key={idx} className="lv-price-row" data-testid={`bw-bd-night-row-${idx}`}>
                        <span className="text-sm">
                          {dayName} {dateNum}
                        </span>
                        <span className="lv-num">{displayPrice(dp.price)}</span>
                      </div>
                    );
                  })}
                  <div className="lv-price-row" data-testid="bw-bd-accommodation-subtotal">
                    <span className="font-semibold">Subtotal</span>
                    <span className="lv-num font-semibold">{displayPrice(breakdownPrice)}</span>
                  </div>
                </>
              );
            } else {
              // Show averaged format (original behavior)
              return (
                <div className="lv-price-row" data-testid="bw-bd-subtotal-row price-line-base">
                  <span>
                    {priceDetails.nights > 0 && perNightForDisplay > 0
                      ? `${displayPrice(perNightForDisplay)} × ${priceDetails.nights} ${priceDetails.nights === 1 ? 'night' : 'nights'}`
                      : 'Accommodation'}
                  </span>
                  <span className="lv-num">{displayPrice(breakdownPrice)}</span>
                </div>
              );
            }
          })()}

          {gstSlabPercent != null && breakdownPrice > 0 && gstLineAmount > 0 && (
            <div className="lv-price-row" data-testid="bw-bd-gst-row">
              <span>
                GST ({gstSlabPercent}%)
              </span>
              <span className="lv-num">{displayPrice(gstLineAmount)}</span>
            </div>
          )}

          {/* TASK-4725: the extra-guest-fee breakdown row was removed — the server-authoritative
              Razorpay charge never included that component, so the row never matched what the
              guest was actually billed. priceDetails.extraGuestsFee is still computed above for
              potential guest-count validation use elsewhere. */}

          {/* TASK-2631 final fix: phantom discount line — appliedDiscountPercent from globalDiscountPercent is not applied to finalTotal, so we hide it to prevent "vapor" discount display */}

          {/* TASK-4322: "Long-stay discount" row removed — it was rendering the tenant
              GLOBAL discount (already netted into breakdownPrice above) mislabeled as a
              TASK-571 LOS discount, and double-subtracting it from the total. The calendar
              pricing DTO has no genuine per-day LOS field today; re-add this row only when
              TASK-571 wires real LOS data through (see the fetchCalendarPricing / disabled
              LOS-fetch-effect comments above). */}

          <div className="lv-price-row" data-testid="bw-bd-service-fee-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Payment processing{convenienceFeePctLabel > 0 ? ` (${convenienceFeePctLabel}%)` : ''}
              <HelpCircle
                className="h-3 w-3 cursor-help text-text-muted"
                aria-label="Razorpay payment gateway fee — passed through, not a platform markup."
              />
            </span>
            <span className="lv-num">{displayPrice(breakdownConvenienceFee)}</span>
          </div>

          {referralDiscountApplied > 0 && (
            <div className="lv-price-row">
              <span style={{ color: '#157046' }}>Referral reward</span>
              <span className="lv-num" style={{ color: '#157046' }}>−{displayPrice(referralDiscountApplied)}</span>
            </div>
          )}

          {promoDiscountApplied > 0 && (
            <div className="lv-price-row">
              <span style={{ color: '#157046' }}>Promo discount</span>
              <span className="lv-num" style={{ color: '#157046' }}>−{displayPrice(promoDiscountApplied)}</span>
            </div>
          )}

          {addOnsTotal > 0 && (
            <div className="lv-price-row">
              <span>Add-ons</span>
              <span className="lv-num">{displayPrice(addOnsTotal)}</span>
            </div>
          )}

          <div className="lv-price-row lv-total">
            <span>Total</span>
            <span className="lv-num">{displayPrice(isNaN(finalTotal) ? 0 : Math.max(1, finalTotal))}</span>
          </div>
        </div>
        )}
        </div>
      {/* end lv-booking-form */}

      {/* TASK-2612: Add-ons moved to GuestDetailsPage */}

      {dateError && (
        <p id={dateErrorId} role="alert" data-testid="guest-booking-date-error" className="text-sm text-support-error" style={{ marginTop: 4 }}>
          {dateError}
        </p>
      )}
      {statusMessage && <p className="text-xs text-text-secondary" style={{ marginTop: 4 }}>{statusMessage}</p>}

      {/* TASK-2612: Guest form fields moved to GuestDetailsPage */}

      {formError && (
        <p className="text-sm text-support-error" role="alert" style={{ marginTop: 4 }}>
          {formError}
        </p>
      )}

      {/* TASK-4293: the check-in day is Blocked/Hold — the Reserve button is disabled, so surface the
          reason proactively (the click-time formError can no longer fire). */}
      {checkinUnavailable && (
        <p className="text-sm text-support-error" role="alert" data-testid="guest-booking-checkin-unavailable" style={{ marginTop: 4 }}>
          Check-in date is not available. Please select a different check-in date.
        </p>
      )}

      {/* TASK-4830: availability fetch failed — the Reserve button is disabled (we cannot trust the
          empty dateStatusMap/blockedSet as all-open). Surface the failure and offer a retry so the
          guest can re-check availability instead of reserving nights that may already be booked. */}
      {availabilityFailed && (
        <div
          className="text-sm text-support-error"
          role="alert"
          data-testid="guest-booking-availability-error"
          style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
        >
          <span>We couldn’t check availability for these dates. Please retry before reserving.</span>
          <button
            type="button"
            onClick={handleAvailabilityRetry}
            data-testid="guest-booking-availability-retry"
            style={{ background: 'transparent', color: '#c2410c', border: '1px solid #c2410c', borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* TASK-2612/2623: Reserve button — init-hold mode, navigates to GuestDetailsPage */}
      <Button
        type="submit"
        fullWidth
        // TASK-4277 / TASK-4911: do NOT disable on blank dates — keep Reserve clickable so
        // handleReserve can surface the inline "Add a check-in/check-out date to continue."
        // validation (and focus the missing field) instead of the button silently swallowing
        // the click. Genuine blockers (service down, invalid range) still disable it.
        disabled={
          isSubmitting ||
          isBookingDisabled ||
          (Boolean(dateRange.startDate) && Boolean(dateRange.endDate) && invalidIstStayRange) ||
          // TASK-4293: check-in day itself is Blocked/Hold — disable up front, don't let the click
          // reach a confusing API-level failure.
          checkinUnavailable ||
          // TASK-4830: availability fetch FAILED — dateStatusMap/blockedSet are empty and cannot be
          // trusted as all-open, so fail CLOSED (a retry control is offered above). This gates on a
          // terminal failure only, NOT on the availability loading window (that stays TASK-4277-safe).
          availabilityFailed ||
          // TASK-4303: pricing still resolving for the selected range (1–3 s worst case) —
          // reserving now would seed holdPriceBreakdown's client fallback with the provisional
          // base-rate/₹0-fee numbers (see the TASK-4286 fallback in handleReserve). Blank dates
          // stay clickable (TASK-4277): rangePricingPending is false without both dates.
          // Do NOT gate on availability-fetch loading — that violated TASK-4277 on F1 (2026-07-12).
          rangePricingPending ||
          // TASK-4554: pricing fetch failed — disable Reserve until a real price loads.
          (hasSelectedRange && calendarPricingFailed) ||
          // TASK-4729: guard against NaN pricing (non-numeric server response)
          (hasSelectedRange && !rangePricingPending && isNaN(finalTotal))
        }
        title={checkinUnavailable ? 'Check-in date is not available. Please select a different check-in date.' : undefined}
        className={`bw-reserve lv-booking-cta${isSubmitting ? ' opacity-75' : ''}`}
        data-testid="guest-booking-submit"
        style={{ marginTop: 20, width: '100%', background: 'var(--gradient-cta, linear-gradient(135deg, #f08c71, #e86a4a))', color: '#fff', border: 0, borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'filter .2s, box-shadow .2s', boxShadow: '0 4px 12px rgba(196, 90, 63, 0.25)' }}
      >
        {isBookingDisabled || checkinUnavailable || availabilityFailed
          ? 'Unavailable'
          : isSubmitting
            ? 'Reserving…'
            : 'Reserve'}
      </Button>
      <p className="bw-charge-note" data-testid="bw-charge-note" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted, #6b5a55)', marginTop: 8 }}>
        You won&apos;t be charged yet
      </p>

      {illustrativeOtaGuestFeeComparison && illustrativeOtaGuestFeeComparison.illustrativeGuestFee > 0 && (
        <p
          className="bw-direct-savings"
          data-testid="bw-direct-savings-line"
          style={{ textAlign: 'center', fontSize: 12, color: '#157046', marginTop: 6, lineHeight: 1.45 }}
        >
          Save ~{displayPrice(illustrativeOtaGuestFeeComparison.illustrativeGuestFee)} vs typical booking sites (illustrative) — direct booking, lower fees than OTAs.
        </p>
      )}

      {/* TASK-2623/TASK-4334: Trust strip — free cancellation, actual computed deadline
          when a check-in date is selected; generic fallback copy otherwise. */}
      <div className="lv-booking-cancel bw-trust" data-testid="bw-trust-strip">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <span data-testid="bw-trust-strip-text">
          {cancellationDeadlineText
            ? `Free cancellation until ${cancellationDeadlineText}`
            : 'Select check-in dates to see your free cancellation deadline'}
        </span>
      </div>

      {/* TASK-4405: universal "book with confidence" post-booking grace-window disclosure — only
          shown when the server has resolved a non-null graceHours for this listing (flag-off parity). */}
      {resolvedGraceHours ? (
        <div className="lv-booking-cancel bw-trust" data-testid="bw-grace-window-strip">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span data-testid="bw-grace-window-strip-text">
            {`Free cancellation for ${resolvedGraceHours} hours after you book`}
          </span>
        </div>
      ) : null}

      {/* Payment trust logos before Razorpay checkout */}
      <div className="lv-pay-rail" data-testid="bw-payment-trust-logos">
        <span className="lv-pay-label">Pay with</span>
        <img src="/icons/upi.svg" alt="UPI" className="lv-pay-icon lv-pay-icon-upi" loading="lazy" decoding="async" width={32} height={20} />
        <img src="/icons/visa.svg" alt="Visa" className="lv-pay-icon" loading="lazy" decoding="async" width={32} height={20} />
        <img src="/icons/rupay.svg" alt="RuPay" className="lv-pay-icon" loading="lazy" decoding="async" width={32} height={20} />
        <span className="lv-pay-secure">Secured by Razorpay</span>
      </div>
    </form>
    </>
  );
};

export default UnitBookingWidget;