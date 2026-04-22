
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/Button';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { useBooking } from '@/contexts/BookingContext';
import { hasRuntimeConfig } from '@/runtime-config';
import ErrorBanner from '@/components/ErrorBanner';
import { type AvailabilityNightlyRate, type AvailabilityResponse } from '@/api/availabilityClient';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { apiFetch } from '@/lib/http';
import { getIstStartOfDay } from '@/utils/date';
import { calculateNights, formatNightCount, formatDateInTimezone } from '@/utils/dateHelpers';
import { doesRangeIntersectBlocked, toISODate } from '@/utils/dateRange';
import { formatCurrency, formatHumanDate } from '@/utils/formatting';
import { calculateNightlyPrice, inferUnitType } from '@/utils/pricing';
import priceDisplayConfig from '@/config/priceDisplay.config';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import { fetchCalendarPricing } from '@/api/pricingClient';
import { useListingPhotosFromApi } from '@/contexts/ListingPhotosContext';
import OptimizedImage from '@/components/ui/OptimizedImage';

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
}

const PENDING_PAYMENT_KEY = 'atlas_pending_razorpay_order';

/** COMP-001: keep in sync with Atlas.Api.Constants.GuestConsentConstants.DisplayText */
const GUEST_DATA_CONSENT_LABEL =
  'I consent to Atlas Homes collecting and using my name, phone, and email to process my booking and send booking communications.';

const normalizeListingId = (value: string | number | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection and try again.';

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
async function abandonPaymentPendingCheckout(bookingId: number, bookingToken: string | null | undefined) {
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

const UnitBookingWidget: React.FC<UnitBookingWidgetProps> = ({
  listingId,
  propertyId,
  listingName,
  timezoneId,
  coverPhotoUrl,
  maxGuests = 16,
}) => {
  if (import.meta.env.DEV) {
    console.assert(Boolean(propertyId), '[UnitBookingWidget] propertyId is required for unit mode');
  }

  const navigate = useNavigate();
  const _location = useLocation();
  const { booking, updateBooking } = useBooking();
  const { getUrlsForListingId } = useListingPhotosFromApi();
  const isBookingDisabled = !hasRuntimeConfig();

  const coverFromPublicListings = useMemo(() => {
    const id = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return undefined;
    return getUrlsForListingId(id)?.[0];
  }, [listingId, getUrlsForListingId]);

  const displayCoverUrl = (coverPhotoUrl?.trim() || coverFromPublicListings || '').trim() || undefined;

  const today = useMemo(() => getIstStartOfDay(), []);
  const maxBookingDate = useMemo(() => addDays(today, 365), [today]);

  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);

  const [dateRange, setDateRange] = useState<AtlasDateRangePickerValue>({
    startDate: today,
    endDate: addDays(today, 1),
  });
  const [openCalendar, setOpenCalendar] = useState(false);
  const [shownDate, setShownDate] = useState<Date>(today);
  const [calendarDailyPrices, setCalendarDailyPrices] = useState<Map<string, number>>(new Map());
  const [calendarConvenienceFeePercent, setCalendarConvenienceFeePercent] = useState<number | undefined>(undefined);
  const [calendarPricingLoading, setCalendarPricingLoading] = useState(false);
  const [guests, setGuests] = useState(2);
  const [_bookedDates, setBookedDates] = useState<Date[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [dateStatusMap, setDateStatusMap] = useState<Map<string, 'Blocked' | 'Available' | 'Hold'>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastAvailabilityKeyRef = useRef<string | null>(null);
  const hasAutoAdjustedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAttemptCount, setPaymentAttemptCount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [minStayNights, setMinStayNights] = useState(1);
  const [minAdvanceDays, setMinAdvanceDays] = useState(0);
  // BUG-104 TASK-314: per-listing max guests from API (overrides static prop default of 16)
  const [apiMaxGuests, setApiMaxGuests] = useState<number | undefined>(undefined);
  const effectiveMaxGuests = apiMaxGuests ?? maxGuests;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    /** QW-005: special requests / notes to host (max 500 server-side) */
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [guestConsentAccepted, setGuestConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [appliedReferralDiscount, setAppliedReferralDiscount] = useState(0);
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [appliedPromoDiscount, setAppliedPromoDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  // TASK-171: add-on services for this listing
  const [availableAddOns, setAvailableAddOns] = useState<Array<{ addOnServiceId: number; name: string; description?: string | null; price: number; priceType: string }>>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({}); // addOnServiceId -> quantity (0 = not selected)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | null>(null);
  const [bookingDetails, setBookingDetails] = useState<{
    bookingId: string;
    bookingToken?: string;
    amount: number;
    propertyName: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    email: string;
    referralCode?: string;
    referralDiscountAmount?: number;
    promoCode?: string;
    promoDiscountAmount?: number;
  } | null>(null);

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
  }, [listingId]);

  // TASK-171: fetch add-on services available for this listing
  useEffect(() => {
    const id = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    const headers = getApiHeaders();
    void (async () => {
      try {
        const url = buildApiUrl(`/listings/${id}/add-ons`);
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json() as Array<{ addOnServiceId: number; name: string; description?: string | null; price: number; priceType: string }>;
          setAvailableAddOns(Array.isArray(data) ? data : []);
        }
      } catch { /* non-critical: just don't show add-ons */ }
    })();
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
      const url = new URL(window.location.href);
      const ref = (url.searchParams.get('ref') || '').trim();
      const stored = (window.localStorage.getItem('atlas_guest_referral_code') || '').trim();
      const seed = (ref || stored).slice(0, 32);
      if (seed) {
        setReferralCode(seed);
        window.localStorage.setItem('atlas_guest_referral_code', seed);
      }
    } catch {
      // no-op
    }
  }, []);

  // Hydrate widget from booking context (e.g. ?checkIn=&checkOut=&guests= from property URL)
  useEffect(() => {
    const ci = booking.checkIn;
    const co = booking.checkOut;
    if (!ci || !co) return;
    const start = getIstStartOfDay(new Date(ci));
    const end = getIstStartOfDay(new Date(co));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    if (end.getTime() <= start.getTime()) return;
    setDateRange({ startDate: start, endDate: end });
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

  // Fetch min stay nights from availability rules (non-blocking)
  useEffect(() => {
    if (!listingId) return;
    let active = true;
    apiFetch(buildApiUrl(`/api/public/listings/${listingId}/availability-rules`))
      .then((r) => r.json())
      .then((d: unknown) => {
        const data = d as { minStayNights?: number; advanceBookingHours?: number; maxGuests?: number };
        if (active && typeof data?.minStayNights === 'number' && data.minStayNights > 1) {
          setMinStayNights(data.minStayNights);
        }
        if (active && typeof data?.advanceBookingHours === 'number' && data.advanceBookingHours > 0) {
          setMinAdvanceDays(Math.ceil(data.advanceBookingHours / 24));
        }
        // BUG-104 TASK-314: enforce per-listing maxGuests (not hardcoded 16)
        if (active && typeof data?.maxGuests === 'number' && data.maxGuests >= 1) {
          setApiMaxGuests(data.maxGuests);
        }
      })
      .catch(() => { /* non-critical — defaults stay */ });
    return () => { active = false; };
  }, [listingId]);

  // Fetch availability automatically on component load and when the calendar is opened
  // Availability always starts from today, independent of selected dates
  useEffect(() => {
    if (!listingId || isBookingDisabled) return;
    
    // Fetch on mount or when calendar opens (but availabilityRange is independent of selected dates)

    let isActive = true;

    const fetchBlockedDates = async () => {
      let availabilityBaseUrl: string;
      try {
        availabilityBaseUrl = buildApiUrl('/availability/listing-availability');
      } catch {
        if (isActive) {
          setIsLoading(false);
        }
        setStatusMessage('Availability service is unavailable. Please try again later.');
        return;
      }
      
      try {
        const url = new URL(availabilityBaseUrl);
        url.searchParams.set('listingId', String(listingId));
        url.searchParams.set('startDate', toISODate(getIstStartOfDay(availabilityRange.startDate)));
        // API expects months (1–12), default 2; we show ~60 days so use 2
        url.searchParams.set('months', '2');

        const availabilityKey = url.toString();
        if (lastAvailabilityKeyRef.current === availabilityKey) {
          return;
        }
        lastAvailabilityKeyRef.current = availabilityKey;

        setIsLoading(true);
        setStatusMessage('Checking availability...');

        const response = await apiFetch(availabilityKey);
        const data = await response.json();

        const entries = Array.isArray(data?.dates)
          ? data.dates
          : Array.isArray(data?.availability)
            ? data.availability
            : Array.isArray(data?.Availability)
              ? data.Availability
              : [];
        
        if (!isActive) return;
        
        // Filter out past dates and process availability with status
        const newBlockedDates = new Set<string>();
        const newDateStatusMap = new Map<string, 'Blocked' | 'Available' | 'Hold'>();
        
        entries.forEach((item: { 
          date?: string; 
          Date?: string;
          status?: string;
          Status?: string;
          inventory?: number; 
          Inventory?: number;
          available?: boolean; 
          blocked?: boolean 
        }) => {
          // Handle both date and Date fields
          const dateStr = item?.date || item?.Date;
          if (!dateStr) return;
          
          const itemDate = getIstStartOfDay(new Date(dateStr));
          const itemISO = toISODate(itemDate);
          
          // Filter out past dates - only process dates from today onwards (inclusive)
          // Use <= instead of < to ensure today is included, but we want >= today, so keep <
          if (itemDate.getTime() < today.getTime()) return;
          
          // Get status from the response (handle both status and Status fields)
          const status = (item.status || item.Status || 'Available') as 'Blocked' | 'Available' | 'Hold';
          
          // Store status for rendering
          newDateStatusMap.set(itemISO, status);
          
          // Update blockedSet for backward compatibility with existing logic
          // Blocked and Hold dates should be in blockedSet (both are non-selectable)
          const isBlocked = 
            status === 'Blocked' ||
            status === 'Hold' ||
            item.blocked === true ||
            item.available === false ||
            (typeof item.inventory === 'number' && item.inventory <= 0) ||
            (typeof item.Inventory === 'number' && item.Inventory <= 0);
          
          if (isBlocked) {
            newBlockedDates.add(itemISO);
          }
        });
        
        setBlockedSet(newBlockedDates);
        setDateStatusMap(newDateStatusMap);
        setBookedDates(Array.from(newBlockedDates).map(date => new Date(date)));
        setStatusMessage(
          newBlockedDates.size > 0
            ? 'Some dates are unavailable due to existing bookings.'
            : 'All dates shown are available to book.'
        );
      } catch (error) {
        console.error('Error fetching blocked dates:', error);
        if (isActive) {
          setStatusMessage('Failed to load availability. Please try again.');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- today stable; run on availability/params change only
  }, [openCalendar, listingId, availabilityRange.endDate, availabilityRange.startDate, isBookingDisabled]);

  // Auto-select next available date if today is blocked or hold
  useEffect(() => {
    // Only run once when availability data is loaded and we haven't auto-adjusted yet
    if (dateStatusMap.size === 0 || hasAutoAdjustedRef.current) return;
    
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
    const startDate = toISODate(startOfMonth(shownDate));
    setCalendarPricingLoading(true);
    fetchCalendarPricing(listingId, startDate, 2, controller.signal)
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
  }, [listingId, shownDate]);

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
  const { loading: dailyPricingLoading, error: dailyPricingError, getListingPricing } = useDailyPricingSummary();
  const dailyPricing = useMemo(
    () => (listingId != null && String(listingId).trim() !== '' ? getListingPricing(listingId) : null),
    [listingId, getListingPricing],
  );

  /** When API has loaded, use its price (including 0). When API has not loaded or failed, we show 0. */
  const effectiveDailyPricing = dailyPricing;

  const formatCalendarPrice = useCallback((price: number): string => {
    if (price >= 10000) return `₹${(price / 1000).toFixed(1)}K`;
    return formatCurrency(price, { maximumFractionDigits: 0 });
  }, []);

  const calendarDealThreshold = useMemo(() => {
    const prices = Array.from(calendarDailyPrices.values()).filter((p) => p > 0);
    if (prices.length < 4) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.25);
    return sorted[idx] ?? null;
  }, [calendarDailyPrices]);

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

  // GST = 5% on discounted price
  const gstAmount = 0;

  // When API has loaded: use API price (or calendar sum). When API has not loaded: use 0.
  const hasSelectedRange = Boolean(dateRange.startDate && dateRange.endDate);
  const breakdownPrice =
    hasSelectedRange && selectedRangeTotalFromCalendar != null
      ? selectedRangeTotalFromCalendar
      : effectiveDailyPricing != null
        ? Math.round(effectiveDailyPricing.actualPrice * (hasSelectedRange ? priceDetails.nights : 1))
        : 0;
  const convenienceFeePercent = calendarConvenienceFeePercent != null ? calendarConvenienceFeePercent / 100 : 0;
  const subtotalForConvenience = priceDetails.total + gstAmount;
  const _convenienceFee = Math.round(subtotalForConvenience * convenienceFeePercent);
  const breakdownSubtotalForConvenience = breakdownPrice + gstAmount;
  const breakdownConvenienceFee = Math.round(breakdownSubtotalForConvenience * convenienceFeePercent);
  const referralDiscountApplied = Math.max(0, appliedReferralDiscount || 0);
  const promoDiscountApplied = Math.max(0, appliedPromoDiscount || 0);
  // TASK-171: compute add-ons subtotal from guest selections
  const addOnsTotal = availableAddOns.reduce((sum, ao) => {
    const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
    return sum + (qty > 0 ? ao.price * qty : 0);
  }, 0);
  const breakdownFinalTotal = Math.max(1, breakdownPrice + gstAmount + breakdownConvenienceFee - referralDiscountApplied - promoDiscountApplied + addOnsTotal);

  const finalTotal =
    hasSelectedRange && selectedRangeTotalFromCalendar != null
      ? breakdownFinalTotal
      : effectiveDailyPricing != null
        ? breakdownFinalTotal
        : 0;

  // Per-night: when API has loaded use API/calendar data; when API not loaded show 0.
  const perNightForDisplay =
    hasSelectedRange && selectedRangeTotalFromCalendar != null && priceDetails.nights > 0
      ? Math.round(selectedRangeTotalFromCalendar / priceDetails.nights)
      : effectiveDailyPricing != null
        ? effectiveDailyPricing.actualPrice
        : 0;

  /** Format price; show ₹0 when 0 (e.g. when API not loaded or API returned 0). */
  const displayPrice = (n: number) =>
    formatCurrency(n, { maximumFractionDigits: 0 });

  const convenienceFeePctLabel = Math.round(convenienceFeePercent * 100);

  const formattedDateLabel = dateRange.startDate && dateRange.endDate
    ? `${timezoneId ? formatDateInTimezone(dateRange.startDate, timezoneId) : format(dateRange.startDate, 'EEE, dd MMM')} – ${timezoneId ? formatDateInTimezone(dateRange.endDate, timezoneId) : format(dateRange.endDate, 'EEE, dd MMM')} • ${priceDetails.nights} ${priceDetails.nights === 1 ? 'night' : 'nights'}`
    : 'Add your travel dates';

  const validateForm = () => {
    const errors = {
      name: '',
      email: '',
      phone: ''
    };
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    const normalizedPhone = formData.phone.replace(/\D/g, '').slice(-10);
    if (!normalizedPhone) {
      errors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^\d{10}$/.test(normalizedPhone)) {
      errors.phone = 'Enter a valid 10-digit Indian mobile number';
      isValid = false;
    }

    if (!guestConsentAccepted) {
      setConsentError('Please accept the consent to continue.');
      isValid = false;
    } else {
      setConsentError('');
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      // IND-003: Indian phone input behavior (accept +91/spacing, store last 10 digits).
      const normalizedPhone = value.replace(/\D/g, '').slice(-10);
      setFormData(prev => ({ ...prev, phone: normalizedPhone }));
      return;
    }
    if (name === 'notes' && value.length > 500) {
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const loadRazorpayScript = (callback: () => void) => {
    if (window.Razorpay) {
      callback();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => callback();
    script.onerror = () => {
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      setFormError('Unable to connect to payment service. Please check your internet connection and try again.');
      setIsSubmitting(false);
      setIsLoading(false);
      toast.error('Unable to connect to payment service. Please try again.');
    };
    document.body.appendChild(script);
  };

  const verifyPayment = async (paymentData: {
    bookingId: string;
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    try {
      if (isBookingDisabled) {
        const message = 'Service temporarily unavailable. Please try again later.';
        setFormError(message);
        throw new Error(message);
      }

      if (!hasRuntimeConfig()) {
        const message = 'Payment service is unavailable. Please try again later.';
        setFormError(message);
        throw new Error(message);
      }

      const requestData = {
        bookingId: paymentData.bookingId,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature
      };

      const response = await axios.post(buildApiUrl('/api/Razorpay/verify'), requestData, {
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
      });
      
      if (response.data.success) {
        setStatusMessage('Payment successful! Your booking is confirmed.');
      } else {
        throw new Error(response.data.message || 'Payment verification failed');
      }
    } catch (error: unknown) {
      console.error('Payment verification error:', {
        error: (error as { response?: { data?: unknown }; message?: string }).response?.data || (error as Error).message,
        status: (error as { response?: { status?: number } }).response?.status,
        headers: (error as { response?: { headers?: unknown } }).response?.headers
      });
      setFormError(getBookingErrorMessage(error, 'verify'));
      throw error;
    }
  };

  // Helper function to find next available date starting from a given date
  // Returns dates that are not blocked/hold
  const findNextAvailableDate = useCallback((startDate: Date): Date | null => {
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
      const isAvailable = checkStatus === 'Available' || (checkStatus === undefined && !blockedSet.has(checkISO));
      
      if (isAvailable) {
        // Checkout date can be blocked/hold - that's allowed (you're leaving, not staying)
        // Only check-in date needs to be available
        return checkDate;
      }
    }
    return null; // No available date found
  }, [dateStatusMap, blockedSet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (isBookingDisabled) {
      setFormError('Service temporarily unavailable. Please try again later.');
      return;
    }

    setDateError(null);

    if (!validateForm()) {
      return;
    }

    // Auto-generate dates if not selected
    let checkinDate: Date;
    let checkoutDate: Date;
    
    if (!dateRange.startDate || !dateRange.endDate) {
      // Ensure availability data is loaded before auto-generating dates
      if (dateStatusMap.size === 0) {
        setFormError('Please wait for availability data to load, or select dates manually.');
        return;
      }
      // Start from today
      const todayISO = toISODate(today);
      const todayStatus = dateStatusMap.get(todayISO);
      const isTodayBlocked = todayStatus === 'Blocked' || todayStatus === 'Hold' || blockedSet.has(todayISO);
      
      let startFromDate: Date | null = null;
      
      // Use today if it's not blocked/hold
      // Checkout date can be blocked/hold - that's allowed (you're leaving, not staying)
      if (!isTodayBlocked) {
        startFromDate = today;
      }
      
      // If today is blocked, find next available date
      if (!startFromDate) {
        const nextAvailable = findNextAvailableDate(today);
        if (!nextAvailable) {
          setFormError('No available dates found. Please try again later.');
          return;
        }
        startFromDate = nextAvailable;
      }
      
      // Verify dates are within the availability range we fetched
      if (startFromDate.getTime() < availabilityRange.startDate.getTime() || 
          addDays(startFromDate, 1).getTime() > availabilityRange.endDate.getTime()) {
        setFormError('Selected dates are outside the available range. Please select dates manually.');
        return;
      }
      
      checkinDate = startFromDate;
      checkoutDate = addDays(startFromDate, 1);
    } else {
      checkinDate = dateRange.startDate;
      checkoutDate = dateRange.endDate;
    }

    const checkinIst = getIstStartOfDay(checkinDate);
    const checkoutIst = getIstStartOfDay(checkoutDate);
    if (checkoutIst.getTime() <= checkinIst.getTime()) {
      setDateError('Check-out must be after check-in.');
      return;
    }
    const stayNights = calculateNights(checkinIst, checkoutIst);
    if (stayNights < 1) {
      setDateError('Check-out must be after check-in.');
      return;
    }

    // Final validation: Only check-in date must be available
    // Checkout date can be blocked/hold - that's allowed (you're leaving, not staying)
    const checkinISO = toISODate(checkinDate);
    const checkinStatus = dateStatusMap.get(checkinISO);
    const isCheckinBlocked = checkinStatus === 'Blocked' || checkinStatus === 'Hold' || blockedSet.has(checkinISO);
    
    // Reject if check-in date is blocked or hold
    if (isCheckinBlocked) {
      setFormError('Check-in date is not available. Please select a different check-in date.');
      return;
    }
    
    // Verify dates are within the availability range we fetched
    if (checkinDate.getTime() < availabilityRange.startDate.getTime() || 
        checkoutDate.getTime() > availabilityRange.endDate.getTime()) {
      setFormError('Selected dates are outside the available range. Please select dates manually.');
      return;
    }

    let orderUrl: string;
    try {
      orderUrl = buildApiUrl('/api/Razorpay/order');
    } catch {
      setFormError('Unable to start checkout. Please try again later.');
      return;
    }

    const numericListingId = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(numericListingId)) {
      setFormError('Property could not be loaded. Please refresh the page and try again.');
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    setFormError(null);
    setStatusMessage(null);
    setPaymentAttemptCount((c) => c + 1);

    try {
      // 1. Create booking draft
      // Normalize dates to IST start of day and format as YYYY-MM-DD (not full ISO string)
      const normalizedCheckin = getIstStartOfDay(checkinDate);
      const normalizedCheckout = getIstStartOfDay(checkoutDate);
      
      const bookingDraft = {
        listingId: numericListingId,
        checkinDate: toISODate(normalizedCheckin),  // Format as YYYY-MM-DD
        checkoutDate: toISODate(normalizedCheckout),  // Format as YYYY-MM-DD
        guests,
        notes: formData.notes.trim().slice(0, 500),
      };

      // 2. Prepare order payload with the exact structure expected by the backend
      // TASK-171: build selectedAddOns array for bookingDraft
      const selectedAddOnsList = availableAddOns
        .filter(ao => (selectedAddOns[ao.addOnServiceId] ?? 0) > 0)
        .map(ao => ({ addOnServiceId: ao.addOnServiceId, quantity: selectedAddOns[ao.addOnServiceId] }));

      const orderPayload = {
        bookingDraft: {
          listingId: bookingDraft.listingId,
          checkinDate: bookingDraft.checkinDate,
          checkoutDate: bookingDraft.checkoutDate,
          guests: bookingDraft.guests,
          notes: bookingDraft.notes,
          selectedAddOns: selectedAddOnsList.length > 0 ? selectedAddOnsList : undefined,
        },
        amount: Math.round(finalTotal), // Keep amount in rupees, let backend handle conversion if needed
        currency: 'INR',
        referralCode: referralCode.trim() ? referralCode.trim().slice(0, 32) : undefined,
        promoCode: promoCode.trim() ? promoCode.trim().slice(0, 32) : undefined,
        guestConsentAccepted: true,
        guestInfo: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim().replace(/\D/g, '').substring(0, 10)
        }
      };

      // 3. Create Razorpay order (idempotency key helps backend detect duplicate submissions)
      const idempotencyKey = crypto.randomUUID();
      const orderResponse = await axios.post(orderUrl, orderPayload, {
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        timeout: 15000
      });

      const {
        keyId: key,
        orderId,
        bookingId,
        bookingToken,
        amount: responseAmount,
        appliedReferralCode: appliedCode,
        referralDiscountAmount,
        referralRewardMessage,
        appliedPromoCode: promoAppliedCode,
        promoDiscountAmount,
        promoMessage: orderPromoMessage,
      } = orderResponse.data ?? {};
      if (!key || !orderId || !bookingId) {
        throw new Error('Checkout could not start: invalid response from payment service. Please try again.');
      }
      setAppliedReferralCode(typeof appliedCode === 'string' && appliedCode.trim() ? appliedCode.trim() : null);
      setAppliedReferralDiscount(Number(referralDiscountAmount) > 0 ? Number(referralDiscountAmount) : 0);
      setReferralMessage(typeof referralRewardMessage === 'string' && referralRewardMessage.trim() ? referralRewardMessage.trim() : null);
      setAppliedPromoCode(typeof promoAppliedCode === 'string' && promoAppliedCode.trim() ? promoAppliedCode.trim() : null);
      setAppliedPromoDiscount(Number(promoDiscountAmount) > 0 ? Number(promoDiscountAmount) : 0);
      setPromoMessage(typeof orderPromoMessage === 'string' && orderPromoMessage.trim() ? orderPromoMessage.trim() : null);

      // Store pending payment for recovery if user refreshes during modal
      localStorage.setItem(PENDING_PAYMENT_KEY, orderId);

      // 4. Load Razorpay script and open checkout
      loadRazorpayScript(() => {
        try {
          let paymentCompleted = false; // Track if payment handler was called

          const handleRazorpayClose = () => {
            if (paymentCompleted) return;
            paymentCompleted = true; // Prevent double-reset from ondismiss + close event
            void abandonPaymentPendingCheckout(bookingId, bookingToken);
            localStorage.removeItem(PENDING_PAYMENT_KEY);
            setIsSubmitting(false);
            setIsLoading(false);
            setPaymentStatus(null);
            setFormError('Payment was cancelled. You can try booking again.');
            toast.info('Payment cancelled. You can try booking again.');
          };

          const options = {
            key,
            amount: orderResponse.data.amount,
            currency: orderResponse.data.currency,
            name: 'Atlas Homestays',
            description: `Booking for ${listingName || 'selected property'}`,
            order_id: orderId,
            prefill: {
              name: formData.name.trim(),
              email: formData.email.trim(),
              contact: formData.phone.trim().replace(/\D/g, '').substring(0, 10)
            },
            theme: {
              color: '#2563eb'
            },
            modal: {
              ondismiss: handleRazorpayClose
            },
            handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
              paymentCompleted = true; // Mark payment as completed
              localStorage.removeItem(PENDING_PAYMENT_KEY);
              try {
                await verifyPayment({
                  bookingId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                });
                
                // Store booking details for success popup
                const nights = checkinDate && checkoutDate 
                  ? calculateNights(checkinDate, checkoutDate) 
                  : 1;
                
                setBookingDetails({
                  bookingId,
                  bookingToken: bookingToken ?? undefined,
                  amount: Number(responseAmount) > 0 ? Number(responseAmount) : Math.max(1, finalTotal),
                  propertyName: listingName || 'Selected Property',
                  checkIn: checkinDate,
                  checkOut: checkoutDate,
                  nights,
                  email: formData.email.trim(),
                  referralCode: typeof appliedCode === 'string' ? appliedCode : undefined,
                  referralDiscountAmount: Number(referralDiscountAmount) > 0 ? Number(referralDiscountAmount) : 0,
                  promoCode: typeof promoAppliedCode === 'string' ? promoAppliedCode : undefined,
                  promoDiscountAmount: Number(promoDiscountAmount) > 0 ? Number(promoDiscountAmount) : 0,
                });
                
                // Set payment status to success to show popup
                setPaymentStatus('success');
                
                // Update booking context on success
                updateBooking({
                  propertyId: propertyId ?? undefined,
                  propertyName: listingName ?? undefined,
                  checkIn: checkinDate.toISOString(),
                  checkOut: checkoutDate.toISOString(),
                  guests,
                  customerInfo: { 
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone
                  },
                  paymentStatus: 'completed',
                  bookingId
                });
              } catch (error) {
                console.error('Payment processing error:', error);
                setPaymentStatus('failed');
                setFormError(getBookingErrorMessage(error, 'verify'));
                if (isNetworkError(error)) toast.error(NETWORK_ERROR_MESSAGE);
              } finally {
                setIsSubmitting(false);
                setIsLoading(false);
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (response: { error?: { description?: string } }) => {
            paymentCompleted = true; // Payment attempt was made
            void abandonPaymentPendingCheckout(bookingId, bookingToken);
            localStorage.removeItem(PENDING_PAYMENT_KEY);
            setPaymentStatus('failed');
            setFormError(`Payment failed: ${response.error?.description || 'Unknown error'}`);
            setIsSubmitting(false);
            setIsLoading(false);
          });
          // Fallback for modal close (ondismiss may not fire in all scenarios)
          rzp.on('close', handleRazorpayClose);

          rzp.open();
        } catch (error) {
          console.error('Error initializing Razorpay:', error);
          localStorage.removeItem(PENDING_PAYMENT_KEY);
          setFormError('Unable to connect to payment service. Please try again.');
          setIsSubmitting(false);
          setIsLoading(false);
          toast.error('Unable to connect to payment service. Please try again.');
        }
      });
    } catch (error: unknown) {
      console.error('Booking error:', error);
      localStorage.removeItem(PENDING_PAYMENT_KEY);
      const msg = getBookingErrorMessage(error, 'order');
      setFormError(msg);
      setIsSubmitting(false);
      setIsLoading(false);
      if (isNetworkError(error)) {
        toast.error(NETWORK_ERROR_MESSAGE);
      }
    }
  };

  const closePaymentPopup = useCallback(() => {
    setPaymentStatus(null);
  }, []);

  const handleRetryPayment = useCallback(() => {
    setPaymentStatus(null);
    setFormError(null);
    setIsSubmitting(false);
    setIsLoading(false);
  }, []);

  // Reset attempt count on successful payment
  const prevPaymentStatus = useRef<'success' | 'failed' | null>(null);
  useEffect(() => {
    if (prevPaymentStatus.current !== 'success' && paymentStatus === 'success') {
      setPaymentAttemptCount(0);
    }
    prevPaymentStatus.current = paymentStatus;
  }, [paymentStatus]);

  const goToDashboard = useCallback(() => {
    closePaymentPopup();
    if (bookingDetails?.bookingId && bookingDetails.bookingToken) {
      navigate(`/booking/${bookingDetails.bookingId}?t=${encodeURIComponent(bookingDetails.bookingToken)}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate, closePaymentPopup, bookingDetails]);

  // Auto-close timers in parent so they are not reset by inner component re-mounts
  useEffect(() => {
    if (paymentStatus === 'failed') {
      const t = window.setTimeout(() => setPaymentStatus(null), 3000);
      return () => window.clearTimeout(t);
    }
    if (paymentStatus === 'success') {
      const t = window.setTimeout(() => setPaymentStatus(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [paymentStatus]);

  // Payment Success Popup Component
  const PaymentSuccessPopup = () => {
    if (!bookingDetails) return null;

    // eslint-disable-next-line react-hooks/rules-of-hooks -- PaymentSuccessPopup only mounts when bookingDetails exists; hook runs in same order when mounted
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closePaymentPopup();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
      // closePaymentPopup is a stable useCallback from the outer component; outer-scope values
      // are not valid deps for inner component useEffect (react-hooks/exhaustive-deps).
    }, []);


    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePaymentPopup();
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 flex flex-col animate-in zoom-in-95 duration-200 relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPaymentStatus(null);
            }}
            className="absolute top-4 right-4 z-[60] p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="p-10">
            {/* Header with Success Icon */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4 shadow-md">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            </div>

            {/* Primary Message */}
            <p className="text-center text-gray-700 mb-6">
              Thank you for your booking. Your payment has been processed successfully.
            </p>

            {/* Booking Details Section */}
            <div className="bg-gray-100 rounded-xl p-6 mb-6 space-y-4 border border-gray-200">
              <h3 className="font-bold text-gray-900 text-lg">Booking Details</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Booking Reference</span>
                  <p className="text-base font-semibold text-gray-900 break-all">{bookingDetails.bookingId}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Amount Paid</span>
                  <p className="text-lg font-bold text-gray-900">
                    {displayPrice(bookingDetails.amount)}
                  </p>
                </div>
                {bookingDetails.referralDiscountAmount && bookingDetails.referralDiscountAmount > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Referral Reward</span>
                    <p className="text-base font-semibold text-green-700">
                      {bookingDetails.referralCode ? `${bookingDetails.referralCode} applied` : 'Applied'} — saved {displayPrice(bookingDetails.referralDiscountAmount)}
                    </p>
                  </div>
                )}
                {bookingDetails.promoDiscountAmount && bookingDetails.promoDiscountAmount > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Promo Discount</span>
                    <p className="text-base font-semibold text-green-700">
                      {bookingDetails.promoCode ? `${bookingDetails.promoCode} applied` : 'Applied'} — saved {displayPrice(bookingDetails.promoDiscountAmount)}
                    </p>
                  </div>
                )}
                {bookingDetails.referralDiscountAmount && bookingDetails.referralDiscountAmount > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Referral Reward</span>
                    <p className="text-base font-semibold text-green-700">
                      {bookingDetails.referralCode ? `${bookingDetails.referralCode} applied` : 'Applied'} — saved {displayPrice(bookingDetails.referralDiscountAmount)}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Property</span>
                  <p className="text-base font-semibold text-gray-900">{bookingDetails.propertyName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Check-in</span>
                    <p className="text-base font-semibold text-gray-900">
                      {formatHumanDate(bookingDetails.checkIn, {
                        locale: 'en-IN',
                        fallback: '—',
                        options: { day: '2-digit', month: 'short', year: 'numeric' },
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Check-out</span>
                    <p className="text-base font-semibold text-gray-900">
                      {formatHumanDate(bookingDetails.checkOut, {
                        locale: 'en-IN',
                        fallback: '—',
                        options: { day: '2-digit', month: 'short', year: 'numeric' },
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Duration</span>
                  <p className="text-base font-semibold text-gray-900">{bookingDetails.nights} {bookingDetails.nights === 1 ? 'night' : 'nights'}</p>
                </div>
              </div>
            </div>

            {/* Confirmation Email Message */}
            <p className="text-center text-gray-700 mb-4">
              A confirmation email has been sent to <span className="font-semibold">{bookingDetails.email}</span> with your booking details and house rules.
            </p>

            {/* Secondary Message */}
            <p className="text-center text-gray-600 mb-6">
              Your booking is confirmed. You will receive check-in instructions 24 hours before arrival.
            </p>
          </div>

          {/* Fixed Bottom Section */}
          <div className="px-10 pb-10 pt-4 border-t border-gray-200 bg-white rounded-b-2xl">
            {/* Buttons */}
            <div className="flex justify-center mb-4">
              <Button
                type="button"
                onClick={goToDashboard}
                className="px-10 py-3 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white shadow-lg"
              >
                View My Booking
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-center text-xs text-gray-500">
              Need help? Contact us at +91-7032493290 or atlashomeskphb@gmail.com
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Payment Failed Popup Component
  const PaymentFailedPopup = () => {
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleRetryPayment();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
      // handleRetryPayment is a stable useCallback from the outer component; outer-scope values
      // are not valid deps for inner component useEffect (react-hooks/exhaustive-deps).
    }, []);

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleRetryPayment();
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[70vh] overflow-hidden animate-in zoom-in-95 duration-200 relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRetryPayment();
            }}
            className="absolute top-4 right-4 z-[60] p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="p-8">
            {/* Header with Error Icon */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Could Not Be Processed</h2>
            </div>

            {/* Primary Message */}
            <p className="text-center text-gray-700 mb-6">
              We're sorry, but your payment didn't go through. Please try again or use a different payment method.
            </p>

            {/* Possible Reasons Section */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">This might happen due to:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                <li>Insufficient funds</li>
                <li>Incorrect payment details</li>
                <li>Network issue</li>
                <li>Card declined</li>
                <li>Payment timeout</li>
              </ul>
            </div>

            {/* Refund Message */}
            <p className="text-center text-gray-600 mb-4">
              If an amount was deducted from your account, it will be refunded to your original payment method within 3-5 business days.
            </p>

            {/* Support Message */}
            <p className="text-center text-gray-700 mb-6 font-medium">
              Persistent issues? Our team is here to help.
            </p>

            {/* Support Contact */}
            <div className="text-center text-xs text-gray-500 space-y-1 mb-6">
              <p>Call: +91-7032493290</p>
              <p>Email: atlashomeskphb@gmail.com</p>
              <p>Live Chat Available</p>
            </div>

            {/* Try Again Button */}
            <div className="flex justify-center">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRetryPayment();
                }}
                className="px-8 py-3 text-base font-semibold bg-[var(--cta-primary)] hover:bg-[var(--cta-primary)]/90 text-white rounded-xl"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {paymentStatus === 'success' && <PaymentSuccessPopup />}
      {paymentStatus === 'failed' && <PaymentFailedPopup />}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6 space-y-5" role="region" aria-label="Booking and availability" data-testid="guest-booking-form">

      {displayCoverUrl && (
        <div className="overflow-hidden rounded-xl border border-border-subtle -mt-1 mb-1">
          <OptimizedImage
            src={displayCoverUrl}
            alt={listingName ? `${listingName} — preview` : 'Listing preview'}
            className="w-full h-40 sm:h-44 object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm uppercase tracking-[0.12em] text-text-muted font-semibold">Reserve</p>
        <h3 className="text-xl sm:text-2xl font-semibold text-text-primary"></h3>
        <p className="text-text-secondary text-sm">Choose your dates to confirm availability for this apartment.</p>
      </div>
      {isBookingDisabled && (
        <ErrorBanner className="mt-2" message="Service temporarily unavailable. Booking will return soon." />
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_18%,transparent)] px-3 py-1 text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
            Best price on our website
          </span>
          <span className="text-xs text-text-muted">Limited-time deal</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {dailyPricingLoading && (
            <span className="text-sm text-text-muted">Loading price…</span>
          )}
          {!dailyPricingLoading && dailyPricingError && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-black">
                {displayPrice(0)}
              </span>
            </div>
          )}
          {!dailyPricingLoading && !dailyPricingError && selectedRangeTotalFromCalendar != null && dateRange.startDate && dateRange.endDate && (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-black">
                {displayPrice(selectedRangeTotalFromCalendar)}
              </span>
              <span className="text-sm text-gray-400">
                {priceDetails.nights} {priceDetails.nights === 1 ? 'night' : 'nights'}
              </span>
            </div>
          )}
          {!dailyPricingLoading && !dailyPricingError && selectedRangeTotalFromCalendar == null && effectiveDailyPricing && (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-black">
                {displayPrice(effectiveDailyPricing.actualPrice)}
              </span>
              {effectiveDailyPricing.globalDiscountPercent > 0 && (
                <>
                  <span className="text-sm text-gray-400">
                    {displayPrice(effectiveDailyPricing.baseAmount)}
                  </span>
                  <span className="text-sm font-semibold text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
                    {priceDisplayConfig.discount.savingsPrefix} {Math.round(effectiveDailyPricing.globalDiscountPercent)}%
                  </span>
                </>
              )}
            </div>
          )}
          {!dailyPricingLoading && !dailyPricingError && selectedRangeTotalFromCalendar == null && !effectiveDailyPricing && (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-black">
                {displayPrice(0)}
              </span>
            </div>
          )}
        </div>
        <div className="text-sm text-text-muted space-y-1 mt-1">
          <p>{priceDetails.nights} {priceDetails.nights === 1 ? 'night' : 'nights'} × {displayPrice(perNightForDisplay)}</p>
          {priceDetails.extraGuests > 0 && priceDetails.nights > 0 && (
            <p>{priceDetails.extraGuests} {priceDetails.extraGuests === 1 ? 'extra guest' : 'extra guests'} × {displayPrice(priceDetails.extraGuestsFee / priceDetails.nights / priceDetails.extraGuests)}/night</p>
          )}
          <p className="text-xs">Includes all taxes and fees</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="unit-booking-dates">
            Dates
          </label>
          <p className="text-xs text-text-secondary">Some dates are unavailable due to existing bookings.</p>
          <button
            id="unit-booking-dates"
            ref={calendarButtonRef}
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-left text-text-primary hover:border-cta-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            aria-label="Click to select check-in date, then choose from calendar"
            title="Click to select check-in date, then choose from calendar"
            disabled={isBookingDisabled}
            onClick={() => {
              if (isBookingDisabled) return;
              setOpenCalendar(true);
            }}
          >
            <div className="flex items-center justify-between gap-3">
  <span className="text-sm sm:text-base">{formattedDateLabel}</span>
  <span className="text-xs text-text-muted">
    {isLoading
      ? 'Loading…'
      : dateRange.startDate && dateRange.endDate
      ? (() => {
          const nights = calculateNights(dateRange.startDate, dateRange.endDate);
          return nights > 0 ? `${nights} ${nights === 1 ? 'date' : 'dates'} blocked` : 'Select dates';
        })()
      : 'Select dates'}
  </span>
</div>

            {dateRange.startDate && dateRange.endDate && calculateNights(dateRange.startDate, dateRange.endDate) > 0 && (
              <div className="mt-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                  {formatNightCount(calculateNights(dateRange.startDate, dateRange.endDate))}
                </span>
              </div>
            )}
          </button>
          <AtlasDateRangePicker
              anchorRef={calendarButtonRef}
              open={openCalendar}
              onClose={() => setOpenCalendar(false)}
              value={dateRange}
              onChange={handleRangeChange}
              loading={isLoading}
              minDate={addDays(today, Math.max(-1, minAdvanceDays - 1))}
              maxDate={maxBookingDate}
              disabledDay={disabledDay}
              months={2}
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
              loadingLabel="Loading availability"
              rangeColors={['#475569']}
              popoverClassName="unit-booking-calendar"
              dateRangeProps={{ preventSnapRefocus: true }}
              dayContentRenderer={(day) => {
                const dayStart = getIstStartOfDay(day);
                const dayISO = toISODate(dayStart);
                const selectionStart = dateRange.startDate ? getIstStartOfDay(dateRange.startDate).getTime() : null;
                const selectionEnd = dateRange.endDate ? getIstStartOfDay(dateRange.endDate).getTime() : null;
                const isRangeStart = selectionStart !== null && dayStart.getTime() === selectionStart;
                const isRangeEnd = selectionEnd !== null && dayStart.getTime() === selectionEnd;
                const rangeStart = selectionStart !== null && selectionEnd !== null ? Math.min(selectionStart, selectionEnd) : null;
                const rangeEnd = selectionStart !== null && selectionEnd !== null ? Math.max(selectionStart, selectionEnd) : null;
                const isInRange =
                  rangeStart !== null && rangeEnd !== null
                    ? dayStart.getTime() >= rangeStart && dayStart.getTime() <= rangeEnd
                    : false;
                const isBlocked = blockedSet.has(dayISO);
                const isDisabled = disabledDay(day);
                const status = dayStart.getTime() >= today.getTime() ? dateStatusMap.get(dayISO) : null;

                const isPastDate = dayStart.getTime() < today.getTime();
                const price = isPastDate ? 0 : (calendarDailyPrices.get(dayISO) ?? effectiveDailyPricing?.actualPrice ?? 0);
                const isDeal =
                  !isPastDate &&
                  calendarDealThreshold != null &&
                  price > 0 &&
                  price <= calendarDealThreshold &&
                  !isRangeStart &&
                  !isRangeEnd &&
                  !isInRange;
                const priceText = isPastDate ? '—' : (calendarPricingLoading ? '…' : formatCalendarPrice(price));

                let statusBg = '';
                if (status === 'Blocked') statusBg = 'bg-red-500/20';
                else if (status === 'Hold') statusBg = 'bg-orange-500/20';
                else if (status === 'Available') statusBg = 'bg-green-500/15';

                const selectionClasses = isRangeStart || isRangeEnd
                  ? 'bg-[var(--cta-primary)] text-white shadow-sm'
                  : isInRange
                    ? 'bg-[var(--cta-primary)]/20 text-[var(--cta-primary)]'
                    : '';
                const disabledClasses = isDisabled
                  ? 'text-gray-400 cursor-not-allowed opacity-60'
                  : status === 'Blocked' || (isBlocked && !status)
                    ? 'text-red-600/90 cursor-not-allowed'
                    : status === 'Hold'
                      ? 'text-orange-600/90 cursor-not-allowed'
                      : 'text-black';

                return (
                  <div className="unit-booking-day-cell grid h-full w-full min-h-0 overflow-hidden box-border p-0.5">
                    {status && statusBg && (
                      <div className={`absolute inset-0 rounded-lg ${statusBg}`} style={{ margin: '2px' }} aria-hidden />
                    )}
                    <div className={`unit-booking-day-cell-inner relative z-10 grid grid-cols-1 grid-rows-2 place-items-center gap-0 min-h-0 overflow-hidden box-border ${selectionClasses || disabledClasses}`}>
                      <span className="unit-booking-day-num text-[11px] font-bold leading-none overflow-hidden truncate">{format(day, 'd')}</span>
                      <span className={`unit-booking-day-price text-xs leading-none whitespace-nowrap overflow-hidden truncate min-w-0 ${isDeal ? 'text-green-600 font-semibold' : ''}`}>
                        {priceText}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="unit-booking-guests">
            Guests
          </label>
          <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-bg-muted px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="!px-2 !py-2 h-12 w-12 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Decrease guests"
                disabled={guests <= 1}
                onClick={() => setGuests((current) => Math.max(1, current - 1))}
              >
                −
              </Button>
              <span className="text-base font-semibold text-text-primary" id="unit-booking-guests">
                {guests} {guests === 1 ? 'guest' : 'guests'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="!px-2 !py-2 h-12 w-12 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Increase guests"
                disabled={guests >= effectiveMaxGuests}
                onClick={() => setGuests((current) => Math.min(effectiveMaxGuests, current + 1))}
              >
                +
              </Button>
            </div>
          </div>
        </div>
        {/* Price Breakdown */}
        <div className="mt-4 border-t border-border-subtle pt-4 text-sm">
          <h4 className="mb-2 text-base font-bold text-text-primary">
            Price Breakdown
          </h4>
          <p className="mb-2 text-xs text-text-muted">
            Final amount shown here is what you pay at checkout.
          </p>
          <div className="space-y-1.5 text-text-secondary">
            <div className="grid grid-cols-[140px_12px_1fr]">
              <span>Room fare</span>
              <span>:</span>
              <span className="text-right">
                {displayPrice(breakdownPrice)}
              </span>
            </div>
            {priceDetails.extraGuestsFee > 0 && (
              <div className="grid grid-cols-[140px_12px_1fr]">
                <span>Extra guest fee</span>
                <span>:</span>
                <span className="text-right">
                  {displayPrice(priceDetails.extraGuestsFee)}
                </span>
              </div>
            )}
            {priceDetails.discount > 0 && (
              <div className="grid grid-cols-[140px_12px_1fr] text-green-700">
                <span>Discount</span>
                <span>:</span>
                <span className="text-right">-{displayPrice(priceDetails.discount)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div className="grid grid-cols-[140px_12px_1fr]">
                <span>GST (5%)</span>
                <span>:</span>
                <span className="text-right">
                  {displayPrice(gstAmount)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-[140px_12px_1fr]">
              <span>Convenience fee{convenienceFeePctLabel > 0 ? ` (${convenienceFeePctLabel}%)` : ''}</span>
              <span>:</span>
              <span className="text-right">
                {displayPrice(breakdownConvenienceFee)}
              </span>
            </div>
            {referralDiscountApplied > 0 && (
              <div className="grid grid-cols-[140px_12px_1fr] text-green-700">
                <span>Referral reward</span>
                <span>:</span>
                <span className="text-right">
                  -{displayPrice(referralDiscountApplied)}
                </span>
              </div>
            )}
            {promoDiscountApplied > 0 && (
              <div className="grid grid-cols-[140px_12px_1fr] text-green-700">
                <span>Promo discount</span>
                <span>:</span>
                <span className="text-right">-{displayPrice(promoDiscountApplied)}</span>
              </div>
            )}
          </div>
          {addOnsTotal > 0 && (
            <div className="grid grid-cols-[140px_12px_1fr] text-text-secondary">
              <span>Add-ons</span>
              <span>:</span>
              <span className="text-right">{displayPrice(addOnsTotal)}</span>
            </div>
          )}
          <div className="mt-3 border-t border-border-subtle pt-3 grid grid-cols-[140px_12px_1fr] text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>:</span>
            <span className="text-right">
              {displayPrice(Math.max(1, finalTotal))}
            </span>
          </div>
          {referralMessage && (
            <p className="mt-2 text-xs text-green-700">
              {referralMessage}{appliedReferralCode ? ` (${appliedReferralCode})` : ''}
            </p>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Direct booking — no platform fee. Pay securely via Razorpay.
          </p>
        </div>

      </div>

      {/* TASK-171: add-on services selection */}
      {availableAddOns.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-bg-muted/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-text-primary">Add-on services</p>
          {availableAddOns.map(ao => {
            const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
            return (
              <div key={ao.addOnServiceId} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{ao.name}</p>
                  {ao.description && <p className="text-xs text-text-muted truncate">{ao.description}</p>}
                  <p className="text-xs text-text-secondary">{displayPrice(ao.price)} / {ao.priceType.replace('_', ' ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {qty > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedAddOns(prev => ({ ...prev, [ao.addOnServiceId]: Math.max(0, (prev[ao.addOnServiceId] ?? 0) - 1) }))}
                        className="w-7 h-7 rounded-full border border-border-strong text-text-primary flex items-center justify-center text-base leading-none"
                        aria-label={`Remove one ${ao.name}`}
                      >−</button>
                      <span className="text-sm font-medium w-4 text-center">{qty}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedAddOns(prev => ({ ...prev, [ao.addOnServiceId]: (prev[ao.addOnServiceId] ?? 0) + 1 }))}
                    className="w-7 h-7 rounded-full border border-border-strong text-text-primary flex items-center justify-center text-base leading-none"
                    aria-label={`Add ${ao.name}`}
                  >+</button>
                </div>
              </div>
            );
          })}
          {addOnsTotal > 0 && (
            <div className="pt-2 border-t border-border-subtle grid grid-cols-[120px_12px_1fr] text-sm text-text-secondary">
              <span>Add-ons</span><span>:</span>
              <span className="text-right">{displayPrice(addOnsTotal)}</span>
            </div>
          )}
        </div>
      )}

      {dateError && <p className="text-sm text-support-error">{dateError}</p>}
      {statusMessage && <p className="text-sm text-text-secondary">{statusMessage}</p>}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="name">
            Full Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            disabled={isBookingDisabled}
            className={`w-full rounded-xl border ${formErrors.name ? 'border-support-error' : 'border-border-strong'} bg-bg-muted px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary`}
            placeholder="Enter your full name"
            data-testid="guest-booking-name"
          />
          {formErrors.name && (
            <p className="text-sm text-support-error" role="alert">
              {formErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="email">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            disabled={isBookingDisabled}
            className={`w-full rounded-xl border ${formErrors.email ? 'border-support-error' : 'border-border-strong'} bg-bg-muted px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary`}
            placeholder="Enter your email"
            data-testid="guest-booking-email"
          />
          {formErrors.email && (
            <p className="text-sm text-support-error" role="alert">
              {formErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="phone">
            Phone Number *
          </label>
          <div className={`flex items-center rounded-xl border ${formErrors.phone ? 'border-support-error' : 'border-border-strong'} bg-bg-muted px-3`}>
            <span className="pr-2 text-text-muted select-none">+91</span>
            <input
              type="tel"
              id="phone"
              name="phone"
              inputMode="numeric"
              pattern="[0-9]{10}"
              value={formData.phone}
              onChange={handleInputChange}
              disabled={isBookingDisabled}
              className="w-full bg-transparent py-3 text-text-primary focus:outline-none"
              placeholder="9876543210"
              maxLength={10}
              data-testid="guest-booking-phone"
            />
          </div>
          <p className="text-xs text-text-muted">Indian mobile number (10 digits)</p>
          {formErrors.phone && (
            <p className="text-sm text-support-error" role="alert">
              {formErrors.phone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="referral-code">
            Referral code <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            id="referral-code"
            name="referralCode"
            value={referralCode}
            onChange={(e) => {
              const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
              setReferralCode(next);
              if (next) window.localStorage.setItem('atlas_guest_referral_code', next);
              else window.localStorage.removeItem('atlas_guest_referral_code');
            }}
            disabled={isBookingDisabled || isSubmitting || isLoading}
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary"
            placeholder="Enter referral code for first-booking rewards"
            data-testid="guest-booking-referral"
          />
          <p className="text-xs text-text-muted">First booking reward: 5% off up to ₹1,500.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="promo-code">
            Promo code <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <input
            type="text"
            id="promo-code"
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32))}
            disabled={isBookingDisabled || isSubmitting || isLoading}
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary"
            placeholder="Enter promo code"
            data-testid="guest-booking-promo"
          />
          {promoMessage ? (
            <p className={`text-xs ${appliedPromoDiscount > 0 ? 'text-green-700' : 'text-text-muted'}`}>
              {promoMessage}{appliedPromoCode ? ` (${appliedPromoCode})` : ''}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="booking-notes">
            Special requests <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="booking-notes"
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleInputChange}
            disabled={isBookingDisabled}
            maxLength={500}
            placeholder="e.g. late check-in, dietary needs, celebration setup"
            className="w-full rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cta-primary resize-y min-h-[88px]"
            data-testid="guest-booking-notes"
          />
          <p className="text-xs text-text-muted">{formData.notes.length}/500</p>
        </div>

        <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-muted/40 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer text-sm text-text-primary">
            <input
              type="checkbox"
              name="guestConsent"
              checked={guestConsentAccepted}
              onChange={(e) => {
                setGuestConsentAccepted(e.target.checked);
                if (e.target.checked) setConsentError('');
              }}
              disabled={isBookingDisabled}
              required
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong text-cta-primary focus:ring-cta-primary"
              data-testid="guest-booking-consent"
              aria-invalid={Boolean(consentError)}
            />
            <span>
              {GUEST_DATA_CONSENT_LABEL}{' '}
              <Link to="/privacy" className="text-cta-primary underline underline-offset-2 hover:opacity-90">
                View Privacy Policy
              </Link>
              .
            </span>
          </label>
          {consentError ? (
            <p className="text-sm text-support-error" role="alert">
              {consentError}
            </p>
          ) : null}
        </div>
      </div>

      {formError && (
        <div className="space-y-1">
          <p className="text-sm text-support-error" role="alert">
            {formError}
          </p>
          {paymentAttemptCount > 0 && (formError.includes('Network') || formError.includes('connection') || formError.includes('Unable to connect')) && (
            <p className="text-xs text-text-muted">Attempt {Math.min(paymentAttemptCount, 3)} of 3 — Click &quot;Book this home&quot; to retry</p>
          )}
        </div>
      )}

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
        className={isSubmitting || isLoading ? 'opacity-75' : ''}
        data-testid="guest-booking-submit"
      >
        {isBookingDisabled ? 'Unavailable' : isSubmitting || isLoading ? 'Processing...' : 'Book this home'}
      </Button>
      {!isBookingDisabled && (
        <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
          <img src="/icons/upi.svg" alt="UPI" className="h-5" />
          <img src="/icons/visa.svg" alt="Visa" className="h-4" />
          <img src="/icons/rupay.svg" alt="RuPay" className="h-4" />
          <span className="text-xs text-text-muted">Secured by Razorpay</span>
        </div>
      )}
    </form>
    </>
  );
};

export default UnitBookingWidget;