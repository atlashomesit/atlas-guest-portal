
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { NETWORK_ERROR_MESSAGE } from './unitBookingPaymentOrderErrors';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/Button';
import { type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { AtlasBookingCalendar } from './AtlasBookingCalendar';
import { useBooking } from '@/contexts/BookingContext';
import { hasRuntimeConfig } from '@/runtime-config';
import ErrorBanner from '@/components/ErrorBanner';
import { type AvailabilityNightlyRate, type AvailabilityResponse } from '@/api/availabilityClient';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import { dedupedAvailabilityCalendarFetch } from '@/api/availabilityCalendarClient';
import { apiFetch } from '@/lib/http';
import { getIstStartOfDay } from '@/utils/date';
import { calculateNights, formatDateInTimezone } from '@/utils/dateHelpers';
import { doesRangeIntersectBlocked, toISODate } from '@/utils/dateRange';
import { formatCurrency } from '@/utils/formatting';
import { HelpCircle } from 'lucide-react';
import { calculateNightlyPrice, inferUnitType } from '@/utils/pricing';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import { fetchCalendarPricing, fetchPricingBreakdown } from '@/api/pricingClient';
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
    Razorpay: new (...args: unknown[]) => { open: (options: unknown) => void };
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
}

const PENDING_PAYMENT_KEY = 'atlas_pending_razorpay_order';

const normalizeListingId = (value: string | number | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

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

/** TASK-255: Best-effort removal of PaymentPending row after Razorpay dismiss/failure (token = order response bookingToken). */
async function _abandonPaymentPendingCheckout(bookingId: number, bookingToken: string | null | undefined) {
  const token = typeof bookingToken === 'string' ? bookingToken.trim() : '';
  if (!token) return;
  try {
    const url = buildApiUrl(
      `/api/guest/bookings/${bookingId}/abandon-checkout?t=${encodeURIComponent(token)}`
    );
    await apiFetch(url, { method: 'POST' });
  } catch {
    /* non-blocking */
  }
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
}) => {
  if (import.meta.env.DEV) {
    console.assert(Boolean(propertyId), '[UnitBookingWidget] propertyId is required for unit mode');
  }

  const navigate = useNavigate();
  const _location = useLocation();
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
  // hostPhone retained in props for future WhatsApp support on GuestDetailsPage
  void hostPhone;

  const today = useMemo(() => getIstStartOfDay(), []);
  const maxBookingDate = useMemo(() => addDays(today, 365), [today]);

  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);

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
  // TASK-571: long-stay (LOS) auto-discount shown in the price breakdown.
  const [losDiscountAmount, setLosDiscountAmount] = useState<number>(0);
  const [losDiscountPercent, setLosDiscountPercent] = useState<number>(0);
  const [guests, setGuests] = useState(2);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [_bookedDates, setBookedDates] = useState<Date[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [dateStatusMap, setDateStatusMap] = useState<Map<string, ListingCalendarDayStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastAvailabilityKeyRef = useRef<string | null>(null);
  const hasAutoAdjustedRef = useRef(false);
  const hasHydratedFromContextRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [minStayNights] = useState(1);
  const minAdvanceDays = 0;
  const effectiveMaxGuests = maxGuests;
  /** RA-006: payment provider not configured for this tenant. */
  const [providerBlocked, setProviderBlocked] = useState(false);

  // Availability range always starts from today, independent of selected dates or shown date
  const availabilityRange = useMemo(() => {
    const startDate = today; // Always start from today
    const endDate = addDays(startDate, 60);
    return { startDate, endDate };
  }, [today]);

  const _resolveNightlyRates = (
    response: AvailabilityResponse,
    normalizedTarget: string,
  ): AvailabilityNightlyRate[] => {
    if (response.nightlyRates) {
      return response.nightlyRates;
    }

    const listing = response.listings?.find((entry) => {
      const candidate = entry.propertyId ?? entry.listingId ?? entry.id;
      return normalizeListingId(candidate) === normalizedTarget;
    });

    return listing?.nightlyRates ?? [];
  };

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

  // Reset auto-adjust flag when listing changes
  useEffect(() => {
    hasAutoAdjustedRef.current = false;
    hasHydratedFromContextRef.current = false;
  }, [listingId]);


  // On mount: clear any stale pending payment (e.g. user refreshed during Razorpay modal)
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_PAYMENT_KEY);
    if (pending) {
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      toast.info('Your previous payment session was interrupted. You can try booking again.');
    }
  }, []);

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
  useEffect(() => {
    const ci = booking.checkIn;
    const co = booking.checkOut;
    if (!ci || !co) return;
    const start = getIstStartOfDay(new Date(ci));
    const end = getIstStartOfDay(new Date(co));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (end.getTime() <= start.getTime()) return;
    setDateRange({ startDate: start, endDate: end });
    hasHydratedFromContextRef.current = true;
  }, [booking.checkIn, booking.checkOut]);

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

        setIsLoading(true);
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
        // Silently handle expected errors: 404, CORS, cancelled requests
        const errorMessage = (error as { message?: string })?.message ?? String(error);
        const is404 = errorMessage.includes('HTTP 404') || errorMessage.includes('404');
        const isCancelled = error instanceof Error && error.name === 'AbortError';
        const isCors = errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch');

        if (!is404 && !isCancelled && !isCors) {
          console.error('Error fetching blocked dates:', error);
          if (isActive) {
            setStatusMessage('');
          }
        } else if (isActive) {
          // 404, CORS, or cancelled - that's OK, just clear the status message
          setStatusMessage('');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchBlockedDates();
    
    return () => {
      isActive = false;
    };
    // availabilityRange is memoized and stable; rely on lastAvailabilityKeyRef deduplication for same requests
  }, [listingId, isBookingDisabled, availabilityRange, today, availabilityRefreshNonce]);

  // Auto-select next available date if today is blocked or hold
  useEffect(() => {
    // Only run once when availability data is loaded and we haven't auto-adjusted yet
    // Also skip if we've already hydrated dates from the booking context (URL params)
    if (dateStatusMap.size === 0 || hasAutoAdjustedRef.current || hasHydratedFromContextRef.current) return;
    
    const todayISO = toISODate(today);
    const todayStatus = dateStatusMap.get(todayISO);
    const isTodayBlocked = todayStatus === 'Blocked' || todayStatus === 'Hold' || blockedSet.has(todayISO);
    
    // If today is blocked/hold, find next available date
    if (isTodayBlocked) {
      // Find next available date (up to 60 days ahead)
      let nextAvailableDate: Date | null = null;
      for (let i = 1; i <= 60; i++) {
        const checkDate = addDays(today, i);
        const checkISO = toISODate(checkDate);
        const checkStatus = dateStatusMap.get(checkISO);
        
        // Skip if status is 'Blocked' or 'Hold' or date is in blockedSet
        if (checkStatus === 'Blocked' || checkStatus === 'Hold' || blockedSet.has(checkISO)) {
          continue;
        }
        
        // Found an available date (status is 'Available' or not set)
        nextAvailableDate = checkDate;
        break;
      }
      
      // Update date range to next available date if found
      if (nextAvailableDate) {
        hasAutoAdjustedRef.current = true;
        setDateRange({
          startDate: nextAvailableDate,
          endDate: addDays(nextAvailableDate, 1),
        });
      }
    } else {
      // Today is available, mark as adjusted so we don't run again
      hasAutoAdjustedRef.current = true;
    }
  }, [dateStatusMap, blockedSet, today]);

  // Fetch per-day calendar pricing so price updates when user selects dates.
  // Fetch on mount and when calendar opens or month changes; do not clear when calendar closes.
  useEffect(() => {
    if (!listingId || String(listingId).trim() === '') return;
    const controller = new AbortController();
    setCalendarPricingLoading(true);
    fetchCalendarPricing(listingId, shownMonthIso, 3, controller.signal)
      .then((result) => {
        setCalendarDailyPrices(result.dateToPrice);
        setCalendarConvenienceFeePercent(result.convenienceFeePercent);
      })
      .catch(() => {
        setCalendarDailyPrices(new Map());
        setCalendarConvenienceFeePercent(undefined);
      })
      .finally(() => {
        setCalendarPricingLoading(false);
      });
    return () => controller.abort();
  }, [listingId, shownMonthIso]);

  const rangeStartIso = dateRange?.startDate ? toISODate(dateRange.startDate) : null;
  const rangeEndIso = dateRange?.endDate ? toISODate(dateRange.endDate) : null;

  // TASK-571: Fetch long-stay (LOS) discount breakdown when guest selects a valid range.
  useEffect(() => {
    if (!listingId || String(listingId).trim() === '') {
      setLosDiscountAmount(0);
      setLosDiscountPercent(0);
      return;
    }
    if (!dateRange?.startDate || !dateRange?.endDate) {
      setLosDiscountAmount(0);
      setLosDiscountPercent(0);
      return;
    }
    const controller = new AbortController();
    fetchPricingBreakdown(
      {
        listingId,
        checkIn: rangeStartIso!,
        checkOut: rangeEndIso!,
      },
      controller.signal,
    )
      .then((b) => {
        const amt = Number(b.losDiscountAmount ?? b.LosDiscountAmount ?? 0);
        const pct = Number(b.losDiscountPercent ?? b.LosDiscountPercent ?? 0);
        setLosDiscountAmount(Number.isFinite(amt) && amt > 0 ? amt : 0);
        setLosDiscountPercent(Number.isFinite(pct) && pct > 0 ? pct : 0);
      })
      .catch(() => {
        setLosDiscountAmount(0);
        setLosDiscountPercent(0);
      });
    return () => controller.abort();
  }, [listingId, rangeStartIso, rangeEndIso, dateRange?.startDate, dateRange?.endDate]);

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

const _isCheckOutAllowed = (date: Date) => {
  const iso = toISODate(getIstStartOfDay(date));
  
  // Check status from dateStatusMap (from GET API response)
  const status = dateStatusMap.get(iso);
  if (status === 'Blocked' || status === 'Hold') {
    // allow check-out if previous day is selected as startDate
    return dateRange.startDate
      ? getIstStartOfDay(date).getTime() === addDays(dateRange.startDate, 1).getTime()
      : false;
  }
  
  // Also check blockedSet for backward compatibility
  if (blockedSet.has(iso)) {
    // allow check-out if previous day is selected as startDate
    return dateRange.startDate
      ? getIstStartOfDay(date).getTime() === addDays(dateRange.startDate, 1).getTime()
      : false;
  }
  return true;
};


  const disabledDay = useCallback((date: Date) => {
  const normalized = getIstStartOfDay(date);
  
  // Disable past dates
  if (normalized.getTime() < today.getTime()) return true;

  const iso = toISODate(normalized);
  
  // Get status from dateStatusMap (from GET API response)
  const status = dateStatusMap.get(iso);
  
  // Disable dates with "Blocked" or "Hold" status
  // Exception: Allow check-out for blocked/hold date if it's right after startDate
  if (status === 'Blocked' || status === 'Hold') {
    if (dateRange.startDate) {
      const nextDay = addDays(dateRange.startDate, 1);
      if (normalized.getTime() === nextDay.getTime()) {
        return false; // allow check-out on blocked/hold date if it's right after startDate
      }
    }
    return true; // disable blocked and hold dates
  }

  // Also check blockedSet for backward compatibility
  if (blockedSet.has(iso)) {
    if (dateRange.startDate) {
      const nextDay = addDays(dateRange.startDate, 1);
      if (normalized.getTime() === nextDay.getTime()) {
        return false; // allow check-out
      }
    }
    return true; // block dates in blockedSet
  }

  return false; // all other dates are selectable
}, [blockedSet, dateStatusMap, today, dateRange.startDate]);

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

  const startISO = toISODate(startIST);
  const endISO = toISODate(endIST);

  // Prevent blocked/hold ranges
  if (doesRangeIntersectBlocked(startISO, endISO, blockedSet)) {
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
    return e <= s;
  }, [dateRange.startDate, dateRange.endDate]);
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

  /** TASK-2870: slab from average nightly room tariff for the selected stay. */
  const gstSlabPercent =
    hasSelectedRange && perNightForDisplay > 0
      ? accommodationGstSlabPercent(perNightForDisplay)
      : null;

  /** GST component of room fare (ADDITIVE — CPO formula per 2026-05-21). */
  const gstLineAmount =
    gstSlabPercent != null && breakdownPrice > 0
      ? accommodationGstLineAmount(breakdownPrice, perNightForDisplay)
      : 0;

  // Razorpay charges its 3% fee on the FULL amount it processes (base + GST), not just base.
  // Sreekar canonical clarification 2026-05-21 (memory: project_guest_booking_pricing_formula).
  const _convenienceFee = Math.round(priceDetails.total * convenienceFeePercent);
  const breakdownConvenienceFee = Math.round((breakdownPrice + gstLineAmount) * convenienceFeePercent);

  // TASK-2631: Total = Base + GST + Service Fee (CPO-canonical formula).
  // GST is additive (5% or 18% of base, not inclusive extraction).
  const breakdownFinalTotal = Math.max(1, breakdownPrice + gstLineAmount + breakdownConvenienceFee);

  const finalTotal =
    hasSelectedRange && selectedRangeTotalFromCalendar != null
      ? breakdownFinalTotal
      : effectiveDailyPricing != null
        ? breakdownFinalTotal
        : 0;

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
    setDateError(null);
    setFormError(null);

    // Date validation
    if (!dateRange.startDate || !dateRange.endDate) {
      setDateError('Please select check-in and check-out dates.');
      return;
    }
    const checkinIst = getIstStartOfDay(dateRange.startDate);
    const checkoutIst = getIstStartOfDay(dateRange.endDate);
    if (checkoutIst.getTime() <= checkinIst.getTime()) {
      setDateError('Check-out must be after check-in.');
      return;
    }
    const stayNights = calculateNights(checkinIst, checkoutIst);
    if (stayNights < 1) {
      setDateError('Check-out must be after check-in.');
      return;
    }

    const checkinISO = toISODate(checkinIst);
    const checkinStatus = dateStatusMap.get(checkinISO);
    if (checkinStatus === 'Blocked' || checkinStatus === 'Hold' || blockedSet.has(checkinISO)) {
      setFormError('Check-in date is not available. Please select a different check-in date.');
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

      const { holdId, holdExpiresAt } = response.data ?? {};
      if (!holdId || !holdExpiresAt) {
        throw new Error('Hold could not be created. Please try again.');
      }

      // Store hold state in context and navigate to details page
      updateBooking({
        holdId: Number(holdId),
        holdExpiresAt: typeof holdExpiresAt === 'string' ? holdExpiresAt : new Date(holdExpiresAt).toISOString(),
        holdPropertySlug: propertySlug ?? null,
        holdUnitSlug: unitSlug ?? null,
        holdListingId: numericListingId,
        holdListingName: listingName ?? null,
        holdPriceBreakdown: {
          baseAmount: breakdownPrice,
          discountAmount: 0,
          convenienceFeeAmount: breakdownConvenienceFee,
          finalAmount: finalTotal > 0 ? finalTotal : breakdownFinalTotal,
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
    isSubmitting, isBookingDisabled, dateRange, dateStatusMap, blockedSet,
    listingId, guests, propertySlug, unitSlug, listingName, breakdownPrice, breakdownConvenienceFee,
    breakdownFinalTotal, finalTotal, updateBooking, navigate,
  ]);

  // Helper function to find next available date starting from a given date
  // Returns dates that are not blocked/hold
  const _findNextAvailableDate = useCallback((startDate: Date): Date | null => {
    // Find next available date (up to 60 days ahead)
    for (let i = 0; i <= 60; i++) {
      const checkDate = addDays(startDate, i);
      const checkISO = toISODate(checkDate);
      const checkStatus = dateStatusMap.get(checkISO);
      
      // Skip if status is 'Blocked' or 'Hold' or date is in blockedSet
      if (checkStatus === 'Blocked' || checkStatus === 'Hold' || blockedSet.has(checkISO)) {
        continue;
      }
      
      // Consider date available if:
      // 1. Status is explicitly 'Available', OR
      // 2. Status is undefined but date is not in blockedSet (API might not return all available dates)
      const isAvailable =
        checkStatus === 'Available' ||
        checkStatus === 'Turnover' ||
        (checkStatus === undefined && !blockedSet.has(checkISO));
      
      if (isAvailable) {
        // Checkout date can be blocked/hold - that's allowed (you're leaving, not staying)
        // Only check-in date needs to be available
        return checkDate;
      }
    }
    return null; // No available date found
  }, [dateStatusMap, blockedSet]);

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
        {hasSelectedRange && finalTotal > 0 ? (
          <>
            <div className="lv-booking-total">
              <b data-testid="bw-per-night-price">{displayPrice(Math.max(1, finalTotal))}</b>
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
                {effectiveDailyPricing != null
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
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#c2410c" aria-hidden="true">
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
          <p className="text-xs font-medium text-text-muted" style={{ marginBottom: 6 }}>Minimum stay: {minStayNights} nights</p>
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
            type="button"
            className="lv-date-cell"
            aria-label="Select check-out date"
            disabled={isBookingDisabled}
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
          <span className="mr-1 inline-block rounded bg-[#ffe8d6]/60 px-1.5 py-0.5 text-[#c2410c]">Available</span>
          open for booking.
          <span className="mx-1 inline-block rounded bg-[#fff3e0] px-1.5 py-0.5 text-[#92400e]">Turnover</span>
          cleaning window (still bookable).
          <span
            className="mx-1 inline-block rounded px-1.5 py-0.5 text-[#64748b]"
            style={{
              background:
                'repeating-linear-gradient(-45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)',
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
              <small style={{ display: 'block', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>Guests</small>
              <span className="lv-guest-val">{guests} {guests === 1 ? 'adult' : 'adults'}</span>
            </div>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#475569', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
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
        {/* v2 block (4): Price breakdown — always-visible, lv-* classes */}
        <div className="lv-price-rows">
          <div className="lv-price-row" data-testid="bw-bd-subtotal-row price-line-base">
            <span>
              {hasSelectedRange && priceDetails.nights > 0 && perNightForDisplay > 0
                ? `${displayPrice(perNightForDisplay)} × ${priceDetails.nights} ${priceDetails.nights === 1 ? 'night' : 'nights'}`
                : 'Accommodation'}
            </span>
            <span className="lv-num">{displayPrice(breakdownPrice)}</span>
          </div>

          {gstSlabPercent != null && breakdownPrice > 0 && gstLineAmount > 0 && (
            <div className="lv-price-row" data-testid="bw-bd-gst-row">
              <span>
                GST ({gstSlabPercent}%) <small style={{ color: '#475569', fontWeight: 400 }}>on accommodation</small>
              </span>
              <span className="lv-num">{displayPrice(gstLineAmount)}</span>
            </div>
          )}

          {priceDetails.extraGuestsFee > 0 && (
            <div className="lv-price-row">
              <span>Extra guest fee</span>
              <span className="lv-num">{displayPrice(priceDetails.extraGuestsFee)}</span>
            </div>
          )}

          {/* TASK-2631 final fix: phantom discount line — appliedDiscountPercent from globalDiscountPercent is not applied to finalTotal, so we hide it to prevent "vapor" discount display */}

          {/* TASK-571: long-stay discount row — only render if nights >= 7 AND discount > 0 */}
          {losDiscountAmount > 0 && priceDetails.nights >= 7 && (
            <div className="lv-price-row">
              <span style={{ color: '#157046' }}>
                Long-stay discount{losDiscountPercent > 0 ? ` (−${Math.round(losDiscountPercent)}%)` : ''}
              </span>
              <span className="lv-num" style={{ color: '#157046' }}>−{displayPrice(losDiscountAmount)}</span>
            </div>
          )}

          <div className="lv-price-row" data-testid="bw-bd-service-fee-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Payment processing{convenienceFeePctLabel > 0 ? ` (${convenienceFeePctLabel}%)` : ''}
              <HelpCircle
                className="h-3 w-3 cursor-help text-text-muted"
                aria-label="Razorpay payment gateway fee — passed through, not an Atlas markup."
                title="Razorpay payment gateway fee — passed through, not an Atlas markup."
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
            <span className="lv-num">{displayPrice(Math.max(1, finalTotal))}</span>
          </div>
        </div>
        </div>
      {/* end lv-booking-form */}

      {/* TASK-2612: Add-ons moved to GuestDetailsPage */}

      {dateError && (
        <p role="alert" data-testid="guest-booking-date-error" className="text-sm text-support-error" style={{ marginTop: 4 }}>
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

      {/* TASK-2612/2623: Reserve button — init-hold mode, navigates to GuestDetailsPage */}
      <Button
        type="submit"
        fullWidth
        disabled={
          isSubmitting ||
          isLoading ||
          !dateRange.startDate ||
          !dateRange.endDate ||
          isBookingDisabled ||
          invalidIstStayRange ||
          priceDetails.nights < 1
        }
        className={`bw-reserve lv-booking-cta${isSubmitting || isLoading ? ' opacity-75' : ''}`}
        data-testid="guest-booking-submit"
        style={{ marginTop: 20, width: '100%', background: '#c2410c', color: '#fff', border: 0, borderRadius: 12, padding: '14px 24px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .2s' }}
      >
        {isBookingDisabled
          ? 'Unavailable'
          : isSubmitting || isLoading
            ? 'Reserving…'
            : 'Reserve'}
      </Button>
      <p className="bw-charge-note" data-testid="bw-charge-note" style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 8 }}>
        You won&apos;t be charged yet
      </p>

      {illustrativeOtaGuestFeeComparison && illustrativeOtaGuestFeeComparison.illustrativeGuestFee > 0 && (
        <p
          className="bw-direct-savings"
          data-testid="bw-direct-savings-line"
          style={{ textAlign: 'center', fontSize: 12, color: '#157046', marginTop: 6, lineHeight: 1.45 }}
        >
          Save ~{displayPrice(illustrativeOtaGuestFeeComparison.illustrativeGuestFee)} vs typical booking sites — no guest service fee on direct bookings.
        </p>
      )}

      {/* TASK-2623: Trust strip — free cancellation (v2 style) */}
      <div className="lv-booking-cancel bw-trust" data-testid="bw-trust-strip">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <span>Free cancellation until 48 hours before check-in</span>
      </div>

      {/* Pay-with rail (v2) */}
      <div className="lv-pay-rail">
        <span className="lv-pay-label">Pay with</span>
        <span className="lv-pay-text">UPI</span>
        <span className="lv-pay-text">VISA</span>
        <span className="lv-pay-text">RUPAY</span>
        <span className="lv-pay-text">RAZORPAY</span>
      </div>
    </form>
    </>
  );
};

export default UnitBookingWidget;