// BookingCard.tsx
import { useState, useRef, useEffect, useMemo, useId, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { API_BASE_URL, IS_API_BASE_CONFIGURED } from '@/config/api';
import { api, asArray } from '@/lib/api';
import { propertyData } from '../../../data';
import { inlinePolicySnippets } from '../../../content/terms';
import { baseGuestAllowance, getUnitPolicy } from '../../../config/policyConfig';
import { trackEvent } from '../../../utils/analytics';
import pricingConfig from '../../../config/pricing.config';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { priceDisplayConfig } from '../../../config/priceDisplay.config';
import { bookingWidgetLayoutFlag } from '../../../config/abFlags';
import { FaUserFriends, FaCreditCard, FaCcVisa, FaCcMastercard } from 'react-icons/fa';
import { SiGooglepay, SiRazorpay } from 'react-icons/si';
import { toast } from 'react-toastify';
import { logApiError, logUserAction, reportError } from '../../../lib/monitoring';
import { useBooking } from '../../../contexts/BookingContext';
import { getIstStartOfDay } from '@/utils/date';

import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import { BookingCardCalendarSection } from './BookingCardCalendarSection';
import { BookingCardGuestsSection } from './BookingCardGuestsSection';
import { BookingCardPricingPaymentSection } from './BookingCardPricingPaymentSection';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface BookingCardProps {
  propertyId: number;
  supportPadding?: boolean;
}

export type GuestCountKey = 'adults' | 'children' | 'infants' | 'pets';

export const defaultGuestLimits: Record<GuestCountKey, { min: number; max?: number }> = {
  adults: { min: 1, max: 10 },
  children: { min: 0, max: 10 },
  infants: { min: 0, max: 2 },
  pets: { min: 0, max: 4 },
};

export interface GuestCounts {
  adults: number;
  children: number;
  childrenAges: number[];
  infants: number;
  pets: number;
}

const BookingCard: React.FC<BookingCardProps> = ({ propertyId, supportPadding = false }) => {
  const serverAnchor = getIstStartOfDay(new Date('2025-12-28T00:00:00+05:30'));
  const todayIst = serverAnchor;
  const todayIstBoundary = serverAnchor;
  const bookingWindowEnd = addDays(serverAnchor, 180);
  const defaultStartDate = todayIst; // Allow booking from server-calculated today
  const defaultEndDate = addDays(todayIst, 1);
  const isLayoutExperimentEnabled = bookingWidgetLayoutFlag();
  const navigate = useNavigate();
  const location = useLocation();
  const { updateBooking } = useBooking();

  const [openCalendar, setOpenCalendar] = useState(false);
  const [openGuests, setOpenGuests] = useState(false);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [bookedRanges, setBookedRanges] = useState<Array<{ start: Date; end: Date }>>([]);
  const [isBookedDatesLoading, setIsBookedDatesLoading] = useState(true);
  const [calendarVisibleMonth, setCalendarVisibleMonth] = useState(getIstStartOfDay(defaultStartDate));
  const [isCalendarTransitioning, setIsCalendarTransitioning] = useState(false);
  const [guestMenuBooting, setGuestMenuBooting] = useState(false);
  const [isRazorpayReady, setIsRazorpayReady] = useState(false);
  const [calendarRenderVersion, setCalendarRenderVersion] = useState(() =>
    getIstStartOfDay(defaultStartDate).toISOString(),
  );
  const [paymentStatus, setPaymentStatus] = useState<
    | { state: 'idle' }
    | {
        state: 'success';
        paymentId: string;
        bookingId: string;
      }
    | {
        state: 'failure';
        reason: string;
      }
  >({ state: 'idle' });

  const ctaPrimaryColor = useMemo(() => {
    if (typeof window === 'undefined') return 'var(--cta-primary)';
    const value = getComputedStyle(document.documentElement).getPropertyValue('--cta-primary').trim();
    return value || 'var(--cta-primary)';
  }, [openCalendar, openGuests]);

  const [dates, setDates] = useState({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    key: 'selection' as const,
  });

  const [guests, setGuests] = useState<GuestCounts>({
    adults: 1,
    children: 0,
    childrenAges: [],
    infants: 0,
    pets: 0,
  });

  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');

  const isTestContactValue = (value: string) => {
    const trimmed = value.trim();
    return trimmed === 'test@example.com' || trimmed === '9999999999';
  };

  const sanitizeStoredContact = (
    value: string | null,
    key: 'atlas_user_email' | 'atlas_user_phone',
  ) => {
    if (!value) return '';
    const trimmed = value.trim();

    if (!trimmed || isTestContactValue(trimmed)) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Unable to clear invalid stored contact info', error);
      }
      return '';
    }

    return trimmed;
  };

  // Load saved email and phone from localStorage on mount
  useEffect(() => {
    try {
      const sessionInitialized = sessionStorage.getItem('atlas_contact_session_initialized');
      if (!sessionInitialized) {
        sessionStorage.setItem('atlas_contact_session_initialized', 'true');
        localStorage.removeItem('atlas_user_email');
        localStorage.removeItem('atlas_user_phone');
        return;
      }

      const savedEmail = sanitizeStoredContact(localStorage.getItem('atlas_user_email'), 'atlas_user_email');
      const savedPhone = sanitizeStoredContact(localStorage.getItem('atlas_user_phone'), 'atlas_user_phone');

      if (savedEmail) setUserEmail(savedEmail);
      if (savedPhone) setUserPhone(savedPhone);
    } catch (error) {
      console.warn('Unable to load saved contact info', error);
    }
  }, []);

  const property = propertyData.find((p) => p.id === Number(propertyId));
  const unitType = inferUnitType({ id: property?.id, property_name: property?.property_name });

  const getTotalGuests = (counts: GuestCounts) => counts.adults + counts.children;
  const totalPeople = guests.adults + guests.children;
  const totalGuestsWithInfants = guests.adults + guests.children + guests.infants;
  const totalGuests = getTotalGuests(guests);
  const oneDay = 24 * 60 * 60 * 1000;

  const nightlyBreakdown = useMemo(() => {
    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    const perNightDates: Date[] = [];
    const cursor = new Date(start);

    while (cursor < end) {
      perNightDates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    if (perNightDates.length === 0) {
      perNightDates.push(new Date(start));
    }

    return perNightDates.map((nightDate) => ({
      date: nightDate,
      breakdown: calculateNightlyPrice({
        unitType,
        checkInDate: nightDate,
        guests: totalPeople,
      }),
    }));
  }, [dates.endDate, dates.startDate, totalPeople, unitType]);

  // Mock data useEffect - disabled, using real API call below
  // useEffect(() => {
  //   const fetchBookedDates = async () => {
  //     ...
  //   };
  //   fetchBookedDates();
  // }, [propertyId]);

  const nights = nightlyBreakdown.length;
  const staySubtotal = nightlyBreakdown.reduce((sum, night) => sum + night.breakdown.finalNightlyPrice, 0);
  const feesAndTaxes = Math.round(staySubtotal * 0.12);
  const totalPrice = staySubtotal + feesAndTaxes;
  const averageNightlyRate = nights > 0 ? Math.round(staySubtotal / nights) : 0;
  const baseNightlyRate = nightlyBreakdown[0]?.breakdown.baseNightlyPrice ?? 0;
  const discountPercentApplied = nightlyBreakdown[0]?.breakdown.appliedDiscountPercent ?? 0;
  const specialPricingNight = nightlyBreakdown.find((night) => night.breakdown.hasSpecialDateMultiplier);
  const hasSpecialPricing = Boolean(specialPricingNight);
  const specialPricingLabel = specialPricingNight?.breakdown.dateKey
    ? priceDisplayConfig.specialPricingLabels[specialPricingNight.breakdown.dateKey] ?? priceDisplayConfig.defaultSpecialLabel
    : hasSpecialPricing
    ? priceDisplayConfig.defaultSpecialLabel
    : null;
  const nightlySavings = nightlyBreakdown[0]?.breakdown.discountAmount ?? 0;
  const hasDiscountToShow = discountPercentApplied > 0 && !hasSpecialPricing;
  const priceBadgeClass = hasSpecialPricing
    ? 'inline-flex items-center rounded-full bg-[color:var(--bg-muted)] px-3 py-1 text-xs font-semibold text-cta-primary text-center'
    : 'inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-cta-primary text-center';
  const propertyMaxCapacity =
    Math.min(
      property?.maxCapacity ??
        pricingConfig.maxGuestsByUnitType?.[unitType] ??
        defaultGuestLimits.adults.max ??
        10,
      20,
    );
  const propertyExtraGuestFee =
    property?.extraGuestFee ?? pricingConfig.extraGuestFeeByUnitType?.[unitType] ?? 0;
  const formattedExtraGuestFee = useMemo(
    () => new Intl.NumberFormat('en-IN').format(propertyExtraGuestFee),
    [propertyExtraGuestFee],
  );

  const propertyGuestLimits = useMemo(
    () => ({
      adults: { ...defaultGuestLimits.adults, max: propertyMaxCapacity },
      children: { ...defaultGuestLimits.children, max: propertyMaxCapacity },
      infants: {
        ...defaultGuestLimits.infants,
        max: Math.min(defaultGuestLimits.infants.max ?? propertyMaxCapacity, propertyMaxCapacity),
      },
      pets: defaultGuestLimits.pets,
    }),
    [propertyMaxCapacity],
  );

  const extraGuestsCount = Math.max(0, totalPeople - baseGuestAllowance);
  const totalExtraGuestCharges = nightlyBreakdown.reduce((sum, night) => sum + night.breakdown.extraGuestFee, 0);

  const formatGuestLabel = () => {
    const { adults, children, infants, pets } = guests;
    const guestCount = adults + children;
    const guestText = guestCount === 1 ? 'guest' : 'guests';
    const infantText = infants === 1 ? 'infant' : 'infants';
    const petText = pets === 1 ? 'pet' : 'pets';

    let label = `${guestCount} ${guestText}`;
    if (infants > 0) {
      label += `, ${infants} ${infantText}`;
    }
    if (pets > 0) {
      label += `, ${pets} ${petText}`;
    }
    return label;
  };

  const guestMenuRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const triggerRowRef = useRef<HTMLDivElement | null>(null);
  const previousOverflowRef = useRef<string>('');
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousOverlayStateRef = useRef({ calendar: false, guests: false });
  const shouldRestoreFocusRef = useRef(false);
  const [triggerRowBottom, setTriggerRowBottom] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);

  const updateTriggerRowPosition = useCallback(() => {
    if (triggerRowRef.current) {
      setTriggerRowBottom(triggerRowRef.current.offsetTop + triggerRowRef.current.offsetHeight);
    }
  }, []);

  const setLastTriggerRef = (element: HTMLButtonElement | null) => {
    if (element) {
      lastTriggerRef.current = element;
    }
  };

  useEffect(() => {
    updateTriggerRowPosition();
    window.addEventListener('resize', updateTriggerRowPosition);
    return () => window.removeEventListener('resize', updateTriggerRowPosition);
  }, [updateTriggerRowPosition]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const guestParam = params.get('guests');
    const checkInParam = params.get('checkIn');
    const checkOutParam = params.get('checkOut');

    const minGuestCount = Math.max(1, propertyGuestLimits.adults.min ?? 0);
    const maxGuestCount = propertyGuestLimits.adults.max ?? propertyMaxCapacity;

    const parsedGuests = Number(guestParam);
    const validGuests =
      Number.isInteger(parsedGuests) && parsedGuests >= minGuestCount && parsedGuests <= maxGuestCount
        ? parsedGuests
        : null;

    const parsedCheckIn = checkInParam ? startOfDay(new Date(checkInParam)) : null;
    const parsedCheckOut = checkOutParam ? startOfDay(new Date(checkOutParam)) : null;

    const hasValidDates =
      parsedCheckIn instanceof Date &&
      parsedCheckOut instanceof Date &&
      !Number.isNaN(parsedCheckIn.getTime()) &&
      !Number.isNaN(parsedCheckOut.getTime()) &&
      parsedCheckIn >= todayIstBoundary &&
      parsedCheckOut > parsedCheckIn;

    if (validGuests !== null) {
      setGuests((prev) => ({ ...prev, adults: validGuests, children: 0, infants: 0, pets: 0, childrenAges: [] }));
    }

    if (hasValidDates && parsedCheckIn && parsedCheckOut) {
      setDates((prev) => ({ ...prev, startDate: parsedCheckIn, endDate: parsedCheckOut }));
    }
  }, [location.search, propertyGuestLimits, propertyMaxCapacity, todayIstBoundary]);
  const [hasInteractedWithDates, setHasInteractedWithDates] = useState(false);
  const [inlineStatus, setInlineStatus] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [ctaConfirmation, setCtaConfirmation] = useState<string | null>(null);
  const [isInlineChecking, setIsInlineChecking] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available'>('idle');
  const [formErrors, setFormErrors] = useState<{ email?: string; phone?: string; dates?: string; guests?: string; terms?: string }>(
    {},
  );
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const phoneRegex = /^\+\d{1,3}\s?\d{6,14}$/;

  useEffect(() => {
    setFormErrors((current) => ({
      ...current,
      email: current.email && emailRegex.test(userEmail) ? undefined : current.email,
      phone: current.phone && phoneRegex.test(userPhone.trim()) ? undefined : current.phone,
    }));
  }, [userEmail, userPhone]);
  const bookingEngagementRef = useRef(false);
  const bookingDropoffTrackedRef = useRef(false);
  const latestPaymentStateRef = useRef(paymentStatus.state);

  const hasSelection = Boolean(dates.startDate && dates.endDate && guests.adults);
  const latestBookingStateRef = useRef({ guests: totalPeople, hasSelection });

  // Load Razorpay Checkout script
  useEffect(() => {
    const loadRazorpay = () => {
      if (window.Razorpay) {
        setIsRazorpayReady(true);
        logUserAction('payment_gateway_cached', { provider: 'razorpay', propertyId });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setIsRazorpayReady(true);
        logUserAction('payment_gateway_loaded', { provider: 'razorpay', propertyId });
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        setIsRazorpayReady(false);
        setPaymentStatus({
          state: 'failure',
          reason: 'Payment setup unavailable. Please refresh to retry.',
        });
        setCtaConfirmation('Payment setup unavailable. Please refresh to retry.');
        logApiError(new Error('Failed to load Razorpay script'), {
          url: script.src,
          method: 'GET',
          category: 'network',
          tags: { provider: 'razorpay', surface: 'booking_form' },
        });
      };
      document.body.appendChild(script);

      return () => {
        // Cleanup: remove script if component unmounts
        const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
          document.body.removeChild(existingScript);
        }
      };
    };

    loadRazorpay();
  }, []);

  const bookingSummary = useMemo(
    () => ({
      propertyName: property?.property_name || 'Atlas Homestays',
      checkIn: format(dates.startDate, 'dd MMM yyyy'),
      checkOut: format(dates.endDate, 'dd MMM yyyy'),
      guests: formatGuestLabel(),
      nights,
      total: totalPrice,
    }),
    [property?.property_name, dates.startDate, dates.endDate, nights, totalPrice, guests],
  );

  const markEngagement = () => {
    if (!bookingEngagementRef.current) {
      bookingEngagementRef.current = true;
    }
  };

  const [awaitingCheckout, setAwaitingCheckout] = useState(false);

  const handleDateChange = (ranges: any) => {
    markEngagement();
    const { startDate, endDate } = ranges.selection;
    setHasInteractedWithDates(true);

    let normalizedStart = startDate ? startOfDay(startDate) : startOfDay(dates.startDate);
    let normalizedEnd = endDate ? startOfDay(endDate) : startOfDay(dates.endDate);
    if (normalizedStart < todayIstBoundary) {
      normalizedStart = todayIstBoundary;
    }

    if (normalizedStart > bookingWindowEnd) {
      normalizedStart = bookingWindowEnd;
    }

    const latestCheckIn = addDays(bookingWindowEnd, -1);
    if (normalizedStart > latestCheckIn) {
      normalizedStart = latestCheckIn;
      normalizedEnd = bookingWindowEnd;
    }

    if (normalizedEnd > bookingWindowEnd) {
      normalizedEnd = bookingWindowEnd;
    }

    setCalendarVisibleMonth(getIstStartOfDay(normalizedStart));
    setCalendarRenderVersion(getIstStartOfDay(normalizedStart).toISOString());
    const isSingleClick = normalizedStart.getTime() === normalizedEnd.getTime();

    const restartSelection = isSingleClick && !awaitingCheckout;
    if (restartSelection) {
      const startIsBeforeIstToday = getIstStartOfDay(normalizedStart) < todayIstBoundary;
      const newStart = startIsBeforeIstToday ? todayIst : normalizedStart;
      setAwaitingCheckout(true);
      setDates({
        startDate: newStart,
        endDate: normalizedEnd,
        key: 'selection',
      });

      const restartMessage = startIsBeforeIstToday ? 'Check-in cannot be in the past.' : 'Choose a check-out date.';
      setDateError(startIsBeforeIstToday ? restartMessage : null);
      setInlineStatus(restartMessage);
      return;
    }

    const effectiveStartDate = startOfDay(normalizedStart);
    let resolvedEndDate = normalizedEnd;
    let errorMessage: string | null = null;

    if (getIstStartOfDay(effectiveStartDate) < todayIstBoundary) {
      errorMessage = 'Check-in date must be today or later';
      toast.error('Check-in date must be today or later');
    }

    if (resolvedEndDate <= effectiveStartDate) {
      resolvedEndDate = addDays(effectiveStartDate, 1);
      errorMessage = 'Check-out must be at least 1 night after check-in.';
      toast.error('Minimum 1-night stay required. Please select a later check-out date.');
    }

    if (resolvedEndDate > bookingWindowEnd) {
      resolvedEndDate = bookingWindowEnd;
      if (effectiveStartDate >= bookingWindowEnd) {
        resolvedEndDate = addDays(bookingWindowEnd, 1);
      }
      errorMessage = 'Bookings are limited to 180 days from today.';
      toast.error('Bookings available up to 180 days in advance');
    }

    if (resolvedEndDate <= effectiveStartDate) {
      resolvedEndDate = addDays(effectiveStartDate, 1);
    }

    setAwaitingCheckout(false);
    setDates({
      startDate: effectiveStartDate,
      endDate: resolvedEndDate,
      key: 'selection',
    });

    setDateError(errorMessage);
    setInlineStatus(errorMessage ?? 'Dates updated for your stay.');

    trackEvent(
      'booking_dates_changed',
      {
        surface: 'booking_form',
        startDate: effectiveStartDate.toISOString(),
        endDate: resolvedEndDate.toISOString(),
      },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );

    logUserAction('booking_dates_selected', {
      propertyId,
      startDate: effectiveStartDate.toISOString(),
      endDate: resolvedEndDate.toISOString(),
      nights: Math.max(1, Math.round(Math.abs((resolvedEndDate.getTime() - effectiveStartDate.getTime()) / oneDay))),
    });

    const selectedNights = Math.max(
      1,
      Math.round(Math.abs((resolvedEndDate.getTime() - effectiveStartDate.getTime()) / oneDay)),
    );
    trackEvent(
      'dates_selected',
      {
        surface: 'booking_form',
        startDate: effectiveStartDate.toISOString(),
        endDate: resolvedEndDate.toISOString(),
        nights: selectedNights,
        guests: totalPeople,
      },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );
  };

  const unitPolicy = getUnitPolicy(propertyId);

  const updateChildAge = (index: number, age: number) => {
    const newAges = [...guests.childrenAges];
    newAges[index] = age;
    setGuests((prev) => ({
      ...prev,
      childrenAges: newAges,
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      const clickedOutsideGuests = guestMenuRef.current && !guestMenuRef.current.contains(event.target);
      const clickedOutsideCalendar = calendarRef.current && !calendarRef.current.contains(event.target);

      if ((openGuests && clickedOutsideGuests) || (openCalendar && clickedOutsideCalendar)) {
        shouldRestoreFocusRef.current = true;
      }

      if (clickedOutsideGuests) {
        setOpenGuests(false);
      }
      if (clickedOutsideCalendar) {
        setOpenCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openCalendar, openGuests]);

  useEffect(() => {
    const body = document.body;

    if (openCalendar || openGuests) {
      previousOverflowRef.current = body.style.overflow;
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = previousOverflowRef.current;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openCalendar || openGuests) {
          shouldRestoreFocusRef.current = true;
        }
        setOpenCalendar(false);
        setOpenGuests(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const activeDialog = openCalendar
        ? calendarRef.current
        : openGuests
        ? guestMenuRef.current
        : null;

      if (!activeDialog) return;

      const focusable = activeDialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const focusTarget = openCalendar ? calendarRef.current : openGuests ? guestMenuRef.current : null;
    focusTarget?.setAttribute('tabIndex', '-1');
    focusTarget?.focus({ preventScroll: true });

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previousOverflowRef.current;
    };
  }, [openCalendar, openGuests]);

  useEffect(() => {
    const previousState = previousOverlayStateRef.current;
    const wasOpen = previousState.calendar || previousState.guests;
    const isOpen = openCalendar || openGuests;

    if (wasOpen && !isOpen && shouldRestoreFocusRef.current) {
      requestAnimationFrame(() => {
        lastTriggerRef.current?.focus({ preventScroll: true });
      });
      shouldRestoreFocusRef.current = false;
    }

    previousOverlayStateRef.current = { calendar: openCalendar, guests: openGuests };
  }, [openCalendar, openGuests]);

  useEffect(() => {
    const fetchBookedDates = async () => {
      setIsBookedDatesLoading(true);

      const requestUrl = `${API_BASE_URL ?? ''}/bookings`;
      const tags = { surface: 'booking_form', propertyId: String(propertyId) };
      const envMode = (import.meta as any)?.env?.MODE ?? 'unknown';

      logUserAction('booking_availability_fetch_start', {
        apiBaseConfigured: IS_API_BASE_CONFIGURED,
        requestUrl,
        envMode,
        propertyId,
      });

      try {
        if (!IS_API_BASE_CONFIGURED) {
          console.info('[BookingCard] 🎭 Using mock bookings for development');
          setInlineStatus('🎭 Using mock data for development. Configure API base URL for live bookings.');
          logUserAction('booking_availability_fetch_mock', { propertyId, envMode });
        }

        // Fetch all bookings from API (or mock data if not configured)
        const response = await api.get('/bookings');
        const allBookings = asArray(response.data, 'bookings');

        console.log('[BookingCard] ===== FETCHING BOOKINGS =====');
        console.log('[BookingCard] PropertyId:', propertyId);
        console.log('[BookingCard] API Base:', API_BASE_URL);
        console.log('[BookingCard] Total bookings from API:', allBookings.length);

        // Extract number from propertyId to match with API listing numbers
        // API listings: "Atlas301", "Atlas501_PH", etc. - extract the number part
        // Property data: propertyId is already a number (301, 501, etc.)
        const targetNumber = String(propertyId);

        console.log('[BookingCard] Looking for property number:', targetNumber);
        console.log('[BookingCard] Sample bookings listing values:',
          allBookings.slice(0, 10).map((b: any) => ({ id: b.id, listing: b.listing })));

        // Filter bookings by extracting number from API listing and comparing with propertyId
        const filteredBookings = allBookings.filter((booking: any) => {
          const bookingListing = String(booking.listing).trim();

          // Extract number from API listing (e.g., "Atlas301" -> "301", "Atlas501_PH" -> "501")
          const numberMatch = bookingListing.match(/(\d+)/);
          if (!numberMatch) {
            return false;
          }

          const bookingNumber = numberMatch[1];
          const matches = bookingNumber === targetNumber;

          if (matches) {
            console.log('[BookingCard] ✓ Matched booking:', {
              id: booking.id,
              listing: bookingListing,
              extractedNumber: bookingNumber,
              propertyId: targetNumber,
              checkin: booking.checkinDate,
              checkout: booking.checkoutDate
            });
          }
          return matches;
        });

        console.log('[BookingCard] Filtered bookings count:', filteredBookings.length);
        // Generate blocked dates: checkinDate (inclusive) to checkoutDate (exclusive)
        // ONLY block dates from today onwards (not past dates)
        // Today is only blocked if it falls within a booking range
        const blockedDates: Date[] = [];
        const todayDate = getIstStartOfDay();

        filteredBookings.forEach((booking: any) => {
          if (!booking.checkinDate || !booking.checkoutDate) {
            console.warn('[BookingCard] Missing dates in booking:', booking);
            return;
          }

          const checkinDate = getIstStartOfDay(new Date(booking.checkinDate));
          const checkoutDate = getIstStartOfDay(new Date(booking.checkoutDate));

          // Validate dates
          if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
            console.warn('[BookingCard] Invalid dates:', {
              checkin: booking.checkinDate,
              checkout: booking.checkoutDate
            });
            return;
          }

          console.log(`[BookingCard] Processing booking ${booking.id}:`);
          console.log(`  Check-in: ${format(checkinDate, 'dd-MM-yyyy')}`);
          console.log(`  Check-out: ${format(checkoutDate, 'dd-MM-yyyy')}`);
          console.log(`  Today: ${format(todayDate, 'dd-MM-yyyy')}`);

          // Block from checkinDate (inclusive) to checkoutDate (exclusive)
          // Only include dates that are today or in the future (skip past dates)
          // Today is only blocked if: today >= checkinDate AND today < checkoutDate
          const datesForThisBooking: Date[] = [];
          let currentDate = new Date(checkinDate);

          while (currentDate < checkoutDate) {
            const dateToBlock = getIstStartOfDay(new Date(currentDate));

            // Only block if date is today or in the future (skip past dates)
            // This ensures today is only blocked if it's actually in the booking range
            if (dateToBlock >= todayDate) {
              datesForThisBooking.push(dateToBlock);
              blockedDates.push(dateToBlock);
            }

            currentDate.setDate(currentDate.getDate() + 1);
          }

          console.log(`  Blocked dates (today and future only): ${datesForThisBooking.map(d => format(d, 'dd-MM-yyyy')).join(',')}`);

          // Check if today is in this booking
          const todayIsInBooking = todayDate >= checkinDate && todayDate < checkoutDate;
          if (todayIsInBooking) {
            console.log(`  ✓ Today is blocked by this booking`);
          } else if (checkinDate < todayDate && checkoutDate > todayDate) {
            console.log(`  Note: Booking started in the past, only blocking from today onwards`);
          }
        });

        // Remove duplicates and sort
        const uniqueBlocked = Array.from(
          new Set(blockedDates.map((d) => d.getTime()))
        )
          .map((time) => new Date(time))
          .sort((a, b) => a.getTime() - b.getTime());

        console.log('[BookingCard] ===== FINAL RESULT =====');
        console.log('[BookingCard] Total unique blocked dates:', uniqueBlocked.length);
        console.log('[BookingCard] Blocked dates:', uniqueBlocked.map(d => format(d, 'dd-MM-yyyy')).join(', '));
        console.log('[BookingCard] ========================');

        logUserAction('booking_availability_fetch_success', {
          propertyId,
          bookingCount: filteredBookings.length,
          apiBase: API_BASE_URL,
        });

        setInlineStatus('Availability refreshed. Review the latest pricing and dates below.');
        setBookedDates(uniqueBlocked);
      } catch (error) {
        console.error('Failed to fetch booked dates:', error);
        logApiError(error, {
          url: requestUrl,
          method: 'GET',
          category: 'network',
          tags,
        });
        setInlineStatus('We could not refresh availability. Please refresh the page or try again shortly.');
        setBookedDates([]);
      } finally {
        setIsBookedDatesLoading(false);
        logUserAction('booking_availability_fetch_end', { propertyId, apiBase: API_BASE_URL });
      }
    };

    fetchBookedDates();
  }, [propertyId]);

  // Handle payment redirect from Razorpay Payment Page
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const bookingId = urlParams.get('bookingId');
    const razorpayPaymentId = urlParams.get('razorpay_payment_id');

    if (paymentStatus === 'success' && bookingId) {
      // Retrieve booking details from sessionStorage
      try {
        const pendingBooking = sessionStorage.getItem('pending_booking');
        if (pendingBooking) {
          const booking = JSON.parse(pendingBooking);
          setPaymentStatus({
            state: 'success',
            paymentId: razorpayPaymentId || 'N/A',
            bookingId: bookingId || booking.bookingId,
          });
          setCtaConfirmation('Payment received. We are confirming your stay.');
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
          sessionStorage.removeItem('pending_booking');
        }
      } catch (error) {
        console.error('Error processing payment success:', error);
      }
    } else if (paymentStatus === 'failed' && bookingId) {
      setPaymentStatus({
        state: 'failure',
        reason: 'Payment could not be completed. Please try again or choose a different method.',
      });
      setCtaConfirmation('Payment was not completed.');
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    latestBookingStateRef.current = { guests: totalPeople, hasSelection };
  }, [hasSelection, totalPeople]);

  useEffect(() => {
    latestPaymentStateRef.current = paymentStatus.state;
  }, [paymentStatus.state]);

  useEffect(
    () => () => {
      if (
        bookingEngagementRef.current &&
        !bookingDropoffTrackedRef.current &&
        latestPaymentStateRef.current === 'idle'
      ) {
        bookingDropoffTrackedRef.current = true;
        trackEvent(
          'booking_widget_dropoff',
          {
            surface: 'booking_form',
            guests: latestBookingStateRef.current.guests,
            hasSelection: latestBookingStateRef.current.hasSelection,
          },
          { propertyId, listingId: propertyId, unitCode: propertyId },
        );
      }
    },
    [propertyId],
  );

  const modifyGuest = (type: GuestCountKey, increment: boolean) => {
    markEngagement();
    setGuests((prev) => {
      const min = propertyGuestLimits[type].min ?? 0;
      const max = propertyGuestLimits[type].max;
      const proposedValue = prev[type] + (increment ? 1 : -1);

      const proposedCounts = { ...prev, [type]: proposedValue } as GuestCounts;
      const exceedsCapacity =
        type !== 'pets' && increment && getTotalGuests(proposedCounts) > propertyMaxCapacity;

      if (!increment && proposedValue < min) return prev;
      if (increment && typeof max === 'number' && proposedValue > max) return prev;
      if (exceedsCapacity) return prev;

      const nextValue =
        typeof max === 'number'
          ? Math.min(max, Math.max(min, proposedValue))
          : Math.max(min, proposedValue);

      const updatedGuests = {
        ...prev,
        [type]: nextValue,
      };
      trackEvent(
        'booking_guest_changed',
        { surface: 'booking_form', field: type, value: nextValue },
        { propertyId, listingId: propertyId, unitCode: propertyId },
      );
      return updatedGuests;
    });
  };

  const isAtMin = (type: GuestCountKey) => guests[type] <= (propertyGuestLimits[type].min ?? 0);
  const isAtMax = (type: GuestCountKey) => {
    if (type === 'pets') {
      return (
        typeof propertyGuestLimits[type].max === 'number' &&
        guests[type] >= (propertyGuestLimits[type].max ?? Number.MAX_SAFE_INTEGER)
      );
    }

    const hitsTypeMax =
      typeof propertyGuestLimits[type].max === 'number' &&
      guests[type] >= (propertyGuestLimits[type].max ?? Number.MAX_SAFE_INTEGER);
    const hitsCapacity = totalGuests >= propertyMaxCapacity;

    return hitsTypeMax || hitsCapacity;
  };

  const primaryCtaLabel = hasSelection && termsAccepted ? 'Book now' : 'Check availability';
  const inlineCtaLabel = hasSelection ? 'Check availability' : 'Select dates';
  const isCheckoutInvalid = dates.endDate <= dates.startDate;
  const guestNeedsAdult = guests.adults < (propertyGuestLimits.adults.min ?? 1);
  const containerPaddingBottom = supportPadding ? 'pb-40' : 'pb-28';
  const validationMessageId = useId();
  const dateErrorId = useId();
  const checkOutErrorId = useId();
  const guestErrorId = useId();
  const capacityMessage = `Maximum capacity: ${propertyMaxCapacity} guests. Extra guests ₹${formattedExtraGuestFee} per additional guest.`;

  useEffect(() => {
    updateTriggerRowPosition();
  }, [openCalendar, openGuests, updateTriggerRowPosition]);

  useEffect(() => {
    updateTriggerRowPosition();
  }, [ctaConfirmation, dateError, guestNeedsAdult, inlineStatus, updateTriggerRowPosition]);
  const validationMessage = useMemo(() => {
    if (dateError) return dateError;
    if (isCheckoutInvalid) return 'Check-out must be at least 1 night after check-in.';
    if (guestNeedsAdult) return 'Add at least one adult.';
    if (totalGuests >= propertyMaxCapacity) return capacityMessage;
    return '';
  }, [dateError, guestNeedsAdult, isCheckoutInvalid]);
  const inlineCtaDisabled = !hasSelection || isCheckoutInvalid;
  const sanitizedPhone = userPhone.trim();
  const submitButtonDisabled =
    availabilityStatus === 'checking' ||
    isLoading ||
    !termsAccepted ||
    !emailRegex.test(userEmail || '') ||
    !phoneRegex.test(sanitizedPhone) ||
    !hasSelection ||
    isCheckoutInvalid ||
    Boolean(formErrors.dates || formErrors.guests || formErrors.email || formErrors.phone || formErrors.terms);
  const liveRegionMessage =
    validationMessage ||
    inlineStatus ||
    ctaConfirmation ||
    (paymentStatus.state === 'success'
      ? 'Payment received successfully.'
      : paymentStatus.state === 'failure'
      ? paymentStatus.reason
      : '');
  const fieldGridClass = isLayoutExperimentEnabled
    ? 'grid grid-cols-1 items-stretch gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6'
    : 'grid grid-cols-1 items-stretch gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6';
  const fieldButtonClass =
    'group flex h-full min-h-[4.5rem] flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface/70 px-4 text-left text-text-primary shadow-inner transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary';
  const helperTextClass = 'mt-1 text-xs font-semibold text-text-muted leading-snug';

  const handleInlineCta = () => {
    markEngagement();
    logUserAction('booking_inline_cta_clicked', {
      propertyId,
      hasSelection,
      nights,
      guests: totalPeople,
    });
    setHasInteractedWithDates(true);
    setIsInlineChecking(true);
    setOpenCalendar(false);
    setOpenGuests(false);
    setInlineStatus('Showing availability for your selection.');
    trackEvent(
      'booking_inline_cta_click',
      { surface: 'booking_form', guests: totalPeople, hasSelection, nights },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );
    if (typeof document !== 'undefined') {
      document
        .getElementById('pricing-breakdown')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.setTimeout(() => {
      setIsInlineChecking(false);
      setInlineStatus('Availability refreshed. Review the pricing breakdown below.');
    }, 650);
  };

  const formatPhoneInput = (value: string) => {
    if (!value) return '';
    const cleaned = value.replace(/[^\d+]/g, '');
    const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/^\+/, '')}`;
    const match = withPlus.match(/^\+(\d{1,3})(\d{0,14})$/);
    if (!match) return withPlus;
    const [, code, rest] = match;
    return rest ? `+${code} ${rest}` : `+${code}`;
  };

  const handleEmailBlur = () => {
    setFormErrors((current) => ({
      ...current,
      email:
        userEmail.trim().length === 0
          ? 'Email is required'
          : emailRegex.test(userEmail.trim())
          ? undefined
          : 'Please enter a valid email address (e.g., user@example.com)',
    }));
  };

  const handlePhoneBlur = () => {
    const trimmed = userPhone.trim();
    setFormErrors((current) => ({
      ...current,
      phone:
        trimmed.length === 0
          ? 'Phone number is required'
          : phoneRegex.test(trimmed)
          ? undefined
          : 'Enter phone with country code (e.g., +91 9876543210)',
    }));
  };

  const handleEmailChange: React.Dispatch<React.SetStateAction<string>> = (value) => {
    const nextValue = typeof value === 'function' ? value(userEmail) : value;
    setUserEmail(nextValue);
    setFormErrors((current) => ({
      ...current,
      email: current.email && emailRegex.test(nextValue.trim()) ? undefined : current.email,
    }));
  };

  const handlePhoneChange: React.Dispatch<React.SetStateAction<string>> = (value) => {
    const nextValue = typeof value === 'function' ? value(userPhone) : value;
    const formatted = formatPhoneInput(nextValue);
    setUserPhone(formatted);
    setFormErrors((current) => ({
      ...current,
      phone: current.phone && phoneRegex.test(formatted.trim()) ? undefined : current.phone,
    }));
  };

  const validateForm = (autoEmail: string, autoPhone: string) => {
    const errors: typeof formErrors = {};

    if (!hasSelection || isCheckoutInvalid) {
      errors.dates = 'Select valid check-in and check-out dates.';
    }

    if (guestNeedsAdult) {
      errors.guests = 'Add at least one adult.';
    }

    if (totalGuests > propertyMaxCapacity) {
      errors.guests = capacityMessage;
    }

    if (!autoEmail || !emailRegex.test(autoEmail)) {
      errors.email = 'Please enter a valid email address (e.g., user@example.com)';
    }

    if (!autoPhone || !phoneRegex.test(autoPhone.trim())) {
      errors.phone = 'Enter phone with country code (e.g., +91 9876543210)';
    }

    if (!termsAccepted) {
      errors.terms = 'Please confirm the Terms & Conditions.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const prefillBookingContext = () => {
    updateBooking({
      propertyId,
      checkIn: dates.startDate.toISOString(),
      checkOut: dates.endDate.toISOString(),
      guests: totalGuestsWithInfants,
    });
  };

  const handleCheckoutNavigation = () => {
    const isValid = validateForm(userEmail, userPhone);
    if (!isValid) {
      setCtaConfirmation('Update the highlighted fields before continuing to checkout.');
      return;
    }

    prefillBookingContext();

    const proceed = window.confirm('Proceed to checkout to reserve this stay?');
    if (!proceed) {
      setCtaConfirmation('Checkout cancelled. You can adjust your details and try again.');
      return;
    }

    navigate('/reserve', { state: { from: location.pathname } });
  };

  const performAvailabilityCheck = async () => {
    setAvailabilityStatus('checking');
    setCtaConfirmation('Checking availability...');

    try {
      const response = await api.get('/bookings');
      const allBookings = asArray(response.data, 'bookings');
      const targetNumber = String(propertyId);

      const selectionStart = getIstStartOfDay(new Date(dates.startDate));
      const selectionEnd = getIstStartOfDay(new Date(dates.endDate));

      const hasConflict = allBookings.some((booking: any) => {
        const bookingListing = String(booking.listing).trim();
        const numberMatch = bookingListing.match(/(\d+)/);
        if (!numberMatch || numberMatch[1] !== targetNumber) return false;

        const checkinDate = getIstStartOfDay(new Date(booking.checkin_date || booking.checkinDate));
        const checkoutDate = getIstStartOfDay(new Date(booking.checkout_date || booking.checkoutDate));

        return selectionStart < checkoutDate && selectionEnd > checkinDate;
      });

      return !hasConflict;
    } catch (error) {
      const isNetworkIssue = error instanceof TypeError;
      setCtaConfirmation(isNetworkIssue ? 'Connection error. Please try again.' : 'System error. Please contact support.');
      setAvailabilityStatus('idle');
      setIsLoading(false);
      return false;
    }
  };

  const startPayment = (autoEmail: string, autoPhone: string) => {
    if (!termsAccepted) {
      setPaymentStatus({ state: 'failure', reason: 'Please accept the Terms & Conditions to continue.' });
      setFormErrors((current) => ({ ...current, terms: 'Please confirm the Terms & Conditions.' }));
      setCtaConfirmation('Please confirm the Terms & Conditions.');
      setIsLoading(false);
      return;
    }

    markEngagement();
    logUserAction('booking_form_submitted', {
      propertyId,
      nights,
      guests: totalPeople,
      hasSelection,
      termsAccepted,
    });
    trackEvent(
      'reserve_click',
      {
        surface: 'booking_form',
        termsAccepted,
        hasSelection,
        guests: totalPeople,
        nights,
      },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );

    trackEvent(
      'availability_search',
      {
        surface: 'booking_form',
        startDate: dates.startDate.toISOString(),
        endDate: dates.endDate.toISOString(),
        guests: totalPeople,
      },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );
    setCtaConfirmation('Launching secure checkout...');

    setPaymentStatus({ state: 'idle' });

    const acceptedAt = termsAcceptedAt || new Date().toISOString();
    setTermsAcceptedAt(acceptedAt);
    try {
      localStorage.setItem('atlas_terms_accepted_at', acceptedAt);
    } catch (error) {
      console.warn('Unable to persist terms acceptance locally', error);
    }

    const bookingId = `ATLAS-${propertyId}-${Date.now()}`;

    trackEvent(
      'checkout_started',
      {
        surface: 'booking_form',
        bookingId,
        total: totalPrice,
        nights,
        guests: totalPeople,
      },
      { propertyId, listingId: propertyId, unitCode: propertyId },
    );

    // Check if Razorpay is loaded
    if (!window.Razorpay || !isRazorpayReady) {
      logApiError(new Error('Payment gateway unavailable'), {
        url: 'https://checkout.razorpay.com/v1/checkout.js',
        method: 'GET',
        category: 'network',
        tags: { provider: 'razorpay', surface: 'booking_form' },
      });
      toast.error('Payment system is still loading. Please try again in a moment.');
      setPaymentStatus({ state: 'failure', reason: 'Payment setup unavailable. Please retry shortly.' });
      setCtaConfirmation('Payment setup unavailable. Please retry shortly.');
      setIsLoading(false);
      return;
    }

    logUserAction('payment_gateway_initializing', {
      provider: 'razorpay',
      bookingId,
      propertyId,
      total: totalPrice,
    });

    // Store booking details in sessionStorage for post-payment handling
    try {
        sessionStorage.setItem('pending_booking', JSON.stringify({
          bookingId,
          propertyId,
          checkIn: bookingSummary.checkIn,
          checkOut: bookingSummary.checkOut,
          guests: bookingSummary.guests,
          nights,
          total: totalPrice,
          email: autoEmail,
          phone: autoPhone,
          termsAcceptedAt: acceptedAt,
        }));
        
        // Also save email and phone to localStorage for future bookings
        try {
          const safeEmail = autoEmail && !isTestContactValue(autoEmail) ? autoEmail : '';
          const safePhone = autoPhone && !isTestContactValue(autoPhone) ? autoPhone : '';

          if (safeEmail) localStorage.setItem('atlas_user_email', safeEmail.trim());
          if (safePhone) localStorage.setItem('atlas_user_phone', safePhone.trim());
        } catch (error) {
          console.warn('Unable to save user contact info', error);
        }
    } catch (error) {
      console.warn('Unable to store booking details', error);
    }

    // Razorpay Key ID - Get from environment variable and ensure we are using a test key in non-production builds
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim();
    const isTestKey = razorpayKeyId?.startsWith('rzp_test_');

    if (!razorpayKeyId || !isTestKey) {
      const reason = !razorpayKeyId
        ? 'Payment configuration missing. Please contact support.'
        : 'Invalid Razorpay test key. Please use a key starting with rzp_test_.';

      setPaymentStatus({ state: 'failure', reason });
      setCtaConfirmation(reason);
      logApiError(new Error('Missing or invalid Razorpay key'), {
        url: 'https://checkout.razorpay.com/v1/checkout.js',
        method: 'GET',
        category: 'config',
        tags: { provider: 'razorpay', surface: 'booking_form' },
      });
      toast.error(reason);
      setIsLoading(false);
      return;
    }

    // Initialize Razorpay Checkout
    const razorpayOptions = {
      key: razorpayKeyId,
      amount: Math.round(totalPrice * 100), // Amount in paise
      currency: 'INR',
      name: property?.property_name || 'Atlas Homestays',
      description: `Booking for ${bookingSummary.checkIn} to ${bookingSummary.checkOut}`,
      prefill: {
        email: autoEmail,
        contact: autoPhone,
        name: autoEmail.split('@')[0], // Use email username as name
      },
      notes: {
        bookingId,
        propertyId: String(propertyId),
        checkIn: bookingSummary.checkIn,
        checkOut: bookingSummary.checkOut,
        guests: bookingSummary.guests,
        nights: String(nights),
        total: String(totalPrice),
        termsAcceptedAt: acceptedAt,
      },
      theme: {
        color: '#6366f1', // Indigo color
      },
      handler: function (response: any) {
        // Payment success callback
        setIsLoading(false);
        setPaymentStatus({
          state: 'success',
          paymentId: response.razorpay_payment_id,
          bookingId,
        });

        toast.success('Payment received. We will confirm your stay shortly.');

        trackEvent(
          'payment_success',
          {
            surface: 'booking_form',
            bookingId,
            paymentId: response.razorpay_payment_id,
            total: totalPrice,
          },
          { propertyId, listingId: propertyId, unitCode: propertyId },
        );
      },
      modal: {
        ondismiss: function () {
          // Payment modal closed without payment
          setIsLoading(false);
          setPaymentStatus({
            state: 'failure',
            reason: 'Payment was cancelled',
          });
          toast.info('Payment was cancelled. You can try again when ready.');
          logUserAction('payment_modal_closed', { provider: 'razorpay', bookingId });
        },
      },
    };

    try {
      logUserAction('payment_gateway_initializing_checkout', {
        provider: 'razorpay',
        bookingId,
        total: totalPrice,
        nights,
      });

      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.on('payment.failed', (response: any) => {
        setPaymentStatus({
          state: 'failure',
          reason: response?.error?.description || 'Payment failed. Please try again.',
        });
        setIsLoading(false);
        toast.error(response?.error?.description || 'Payment failed. Please try again.');
        logApiError(new Error(response?.error?.description || 'Razorpay payment failed'), {
          url: 'https://checkout.razorpay.com/v1/checkout.js',
          method: 'POST',
          category: 'payment',
          tags: { provider: 'razorpay', surface: 'booking_form' },
        });
      });

      razorpay.open();
      logUserAction('payment_gateway_initialized', {
        provider: 'razorpay',
        bookingId,
        total: totalPrice,
        nights,
      });
    } catch (error) {
      reportError(error, { feature: 'razorpay', bookingId, propertyId });
      logApiError(error, {
        url: 'https://checkout.razorpay.com/v1/checkout.js',
        method: 'GET',
        category: 'network',
        tags: { provider: 'razorpay', surface: 'booking_form' },
      });
      setIsLoading(false);
      toast.error('Failed to open payment options. Please try again.');
      setPaymentStatus({
        state: 'failure',
        reason: 'Failed to initialize payment',
      });
    }
  };

  const initiatePayment = async () => {
    const autoEmail = userEmail.trim();
    const autoPhone = userPhone.trim();

    setCtaConfirmation(null);
    setAvailabilityStatus('idle');
    setFormErrors({});

    if (!termsAccepted) {
      setFormErrors((current) => ({ ...current, terms: 'Please confirm the Terms & Conditions.' }));
      setPaymentStatus({ state: 'failure', reason: 'Please accept the Terms & Conditions to continue.' });
      setCtaConfirmation('Please confirm the Terms & Conditions.');
      return;
    }

    if (!validateForm(autoEmail, autoPhone)) {
      setCtaConfirmation('Please fix the highlighted fields.');
      return;
    }

    setIsLoading(true);
    const isAvailable = await performAvailabilityCheck();

    if (!isAvailable) {
      setAvailabilityStatus('idle');
      if (!ctaConfirmation) {
        setCtaConfirmation('Selected dates unavailable. Please choose different dates.');
      }
      setIsLoading(false);
      return;
    }

    setAvailabilityStatus('available');
    setCtaConfirmation('Available! Proceeding to payment...');
    setHasInteractedWithDates(true);
    setInlineStatus('Showing the final pricing breakdown for your dates.');

    window.setTimeout(() => {
      startPayment(autoEmail, autoPhone);
    }, 1200);
  };

  return (
    <div
      id="booking-form"
      className={`mx-auto w-full max-w-6xl p-6 bg-bg-surface shadow-level2 rounded-2xl relative ${containerPaddingBottom}`}
    >
      <div className="sr-only" role="status" aria-live="polite">
        <span id={validationMessageId}>{liveRegionMessage || 'Booking form ready'}</span>
      </div>

      <BookingCardCalendarSection
        hasDiscountToShow={hasDiscountToShow}
        baseNightlyRate={baseNightlyRate}
        averageNightlyRate={averageNightlyRate}
        nightlySavings={nightlySavings}
        discountPercentApplied={discountPercentApplied}
        hasSpecialPricing={hasSpecialPricing}
        specialPricingLabel={specialPricingLabel}
        priceBadgeClass={priceBadgeClass}
        property={property}
        baseGuestAllowance={baseGuestAllowance}
        unitPolicy={unitPolicy}
        fieldGridClass={fieldGridClass}
        fieldButtonClass={fieldButtonClass}
        helperTextClass={helperTextClass}
        markEngagement={markEngagement}
        setOpenCalendar={setOpenCalendar}
        setOpenGuests={setOpenGuests}
        setInlineStatus={setInlineStatus}
        trackEvent={trackEvent}
        propertyId={propertyId}
        dates={dates}
        dateError={dateError}
        validationMessage={validationMessage}
        validationMessageId={validationMessageId}
        setHasInteractedWithDates={setHasInteractedWithDates}
        isCheckoutInvalid={isCheckoutInvalid}
        dateErrorId={dateErrorId}
        checkOutErrorId={checkOutErrorId}
        hasInteractedWithDates={hasInteractedWithDates}
        guestNeedsAdult={guestNeedsAdult}
        guestErrorId={guestErrorId}
        formatGuestLabel={formatGuestLabel}
        handleInlineCta={handleInlineCta}
        inlineCtaDisabled={inlineCtaDisabled}
        isInlineChecking={isInlineChecking}
        inlineCtaLabel={inlineCtaLabel}
        inlineStatus={inlineStatus}
        ctaConfirmation={ctaConfirmation}
        openCalendar={openCalendar}
        calendarRef={calendarRef}
        triggerRowRef={triggerRowRef}
        isBookedDatesLoading={isBookedDatesLoading}
        bookedDates={bookedDates}
        handleDateChange={handleDateChange}
        calendarVisibleMonth={calendarVisibleMonth}
        calendarRenderVersion={calendarRenderVersion}
        onMonthYearChange={(date) => {
          const nextMonth = getIstStartOfDay(date);
          setCalendarVisibleMonth(nextMonth);
          setCalendarRenderVersion(nextMonth.toISOString());
          setIsCalendarTransitioning(true);
          window.setTimeout(() => setIsCalendarTransitioning(false), 200);
        }}
        isCalendarTransitioning={isCalendarTransitioning}
          maxBookingDate={bookingWindowEnd}
          minBookingDate={todayIstBoundary}
          ctaPrimaryColor={ctaPrimaryColor}
          setLastTriggerRef={setLastTriggerRef}
          nights={nights}
        />

      <BookingCardGuestsSection
        openGuests={openGuests}
        guestMenuRef={guestMenuRef}
        guestMenuBooting={guestMenuBooting}
        guests={guests}
        modifyGuest={modifyGuest}
        isAtMin={isAtMin}
        isAtMax={isAtMax}
        setGuests={setGuests}
        guestLimits={propertyGuestLimits}
        maxCapacity={propertyMaxCapacity}
        extraGuestFee={propertyExtraGuestFee}
        totalGuests={totalGuests}
        updateChildAge={updateChildAge}
        markEngagement={markEngagement}
        setOpenGuests={setOpenGuests}
        triggerRowBottom={triggerRowBottom}
      />

      <BookingCardPricingPaymentSection
        hasSelection={hasSelection}
        hasInteractedWithDates={hasInteractedWithDates}
        nightlyBreakdown={nightlyBreakdown}
        baseNightlyRate={baseNightlyRate}
        discountPercentApplied={discountPercentApplied}
        extraGuestsCount={extraGuestsCount}
        totalExtraGuestCharges={totalExtraGuestCharges}
        feesAndTaxes={feesAndTaxes}
        totalPrice={totalPrice}
        nights={nights}
        inlinePolicySnippets={inlinePolicySnippets}
        isRazorpayReady={isRazorpayReady}
        isLoading={isLoading}
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        termsAcceptedAt={termsAcceptedAt}
        setTermsAcceptedAt={setTermsAcceptedAt}
        initiatePayment={initiatePayment}
        onProceedToCheckout={handleCheckoutNavigation}
        primaryCtaLabel={primaryCtaLabel}
        availabilityStatus={availabilityStatus}
        ctaConfirmation={ctaConfirmation}
        paymentStatus={paymentStatus}
        setPaymentStatus={setPaymentStatus}
        formatGuestLabel={formatGuestLabel}
        dates={dates}
        FaUserFriendsIcon={FaUserFriends}
        SiRazorpayIcon={SiRazorpay}
        FaCreditCardIcon={FaCreditCard}
        SiGooglepayIcon={SiGooglepay}
        FaCcVisaIcon={FaCcVisa}
        FaCcMastercardIcon={FaCcMastercard}
        userEmail={userEmail}
        setUserEmail={handleEmailChange}
        onEmailBlur={handleEmailBlur}
        userPhone={userPhone}
        setUserPhone={handlePhoneChange}
        onPhoneBlur={handlePhoneBlur}
        formErrors={formErrors}
        averageRating={property?.property_rating}
        reviewCount={property?.property_reviews}
        submitButtonDisabled={submitButtonDisabled}
      />
    </div>
  );
};

export default BookingCard;