// BookingCard.tsx
import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { api, asArray } from '@/lib/api';
import { propertyData } from '../../../data';
import { inlinePolicySnippets } from '../../../content/terms';
import { baseGuestAllowance, getUnitPolicy } from '../../../config/policyConfig';
import { trackEvent } from '../../../utils/analytics';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { priceDisplayConfig } from '../../../config/priceDisplay.config';
import { bookingWidgetLayoutFlag } from '../../../config/abFlags';
import { FaUserFriends, FaCreditCard, FaCcVisa, FaCcMastercard } from 'react-icons/fa';
import { SiGooglepay, SiRazorpay } from 'react-icons/si';

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

export const guestLimits: Record<GuestCountKey, { min: number; max?: number }> = {
  adults: { min: 0, max: 10 },
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
  const today = startOfDay(new Date());
  const defaultStartDate = addDays(today, 1);
  const defaultEndDate = addDays(today, 2);
  const isLayoutExperimentEnabled = bookingWidgetLayoutFlag();

  const [openCalendar, setOpenCalendar] = useState(false);
  const [openGuests, setOpenGuests] = useState(false);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [bookedRanges, setBookedRanges] = useState<Array<{ start: Date; end: Date }>>([]);
  const [isBookedDatesLoading, setIsBookedDatesLoading] = useState(true);
  const [guestMenuBooting, setGuestMenuBooting] = useState(false);
  const [isRazorpayReady, setIsRazorpayReady] = useState(false);
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
  }, []);

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

  const property = propertyData.find((p) => p.id === Number(propertyId));
  const unitType = inferUnitType({ id: property?.id, property_name: property?.property_name });

  const totalPeople = guests.adults + guests.children;
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

  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const mockResponse = [
          {
            id: 501,
            listingId: 2,
            guestId: 559,
            checkinDate: '2025-09-23T00:00:00',
            checkoutDate: '2025-09-24T00:00:00',
            bookingSource: 'airbnb',
            amountReceived: 2358.09,
            bankAccountId: null,
            guestsPlanned: 2,
            guestsActual: 2,
            extraGuestCharge: 0.0,
            commissionAmount: 377.29,
            notes: '-',
            createdAt: '2025-09-23T04:35:36.5110894',
            paymentStatus: 'Paid',
          },
        ];

        const datesRanges = mockResponse.map((booking) => ({
          start: new Date(booking.checkinDate),
          end: new Date(booking.checkoutDate),
        }));

        const allBookedDates: Date[] = [];
        datesRanges.forEach((range) => {
          const current = new Date(range.start);
          while (current <= range.end) {
            allBookedDates.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }
        });

        setBookedRanges(datesRanges);
        setBookedDates(allBookedDates);
        setIsBookedDatesLoading(false);
      } catch (error) {
        console.error('Error fetching booked dates:', error);
        setIsBookedDatesLoading(false);
      }
    };

    fetchBookedDates();
  }, [propertyId]);

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
  const extraGuestsCount = Math.max(0, totalPeople - baseGuestAllowance);
  const totalExtraGuestCharges = nightlyBreakdown.reduce((sum, night) => sum + night.breakdown.extraGuestFee, 0);

  const formatGuestLabel = () => {
    const { adults, children, infants, pets } = guests;
    const guestCount = adults + children + infants;
    const guestText = guestCount === 1 ? 'guest' : 'guests';
    const petText = pets === 1 ? 'pet' : 'pets';

    let label = `${guestCount} ${guestText}`;
    if (pets > 0) {
      label += `, ${pets} ${petText}`;
    }
    return label;
  };

  const guestMenuRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [hasInteractedWithDates, setHasInteractedWithDates] = useState(false);
  const [inlineStatus, setInlineStatus] = useState('');
  const [ctaConfirmation, setCtaConfirmation] = useState<string | null>(null);
  const [isInlineChecking, setIsInlineChecking] = useState(false);
  const bookingEngagementRef = useRef(false);
  const bookingDropoffTrackedRef = useRef(false);
  const latestPaymentStateRef = useRef(paymentStatus.state);

  const hasSelection = Boolean(dates.startDate && dates.endDate && guests.adults);
  const latestBookingStateRef = useRef({ guests: totalPeople, hasSelection });

  const preloadRazorpay = () => {
    const existingPreload = document.querySelector(
      "link[rel='preload'][href='https://checkout.razorpay.com/v1/checkout.js']",
    );
    if (!existingPreload) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'script';
      preloadLink.href = 'https://checkout.razorpay.com/v1/checkout.js';
      document.head.appendChild(preloadLink);
    }

    const existingPreconnect = document.querySelector(
      "link[rel='preconnect'][href='https://checkout.razorpay.com']",
    );
    if (!existingPreconnect) {
      const preconnectLink = document.createElement('link');
      preconnectLink.rel = 'preconnect';
      preconnectLink.href = 'https://checkout.razorpay.com';
      document.head.appendChild(preconnectLink);
    }
  };

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        setIsRazorpayReady(true);
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        "script[src='https://checkout.razorpay.com/v1/checkout.js']",
      ) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          setIsRazorpayReady(true);
          resolve(true);
        });
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setIsRazorpayReady(true);
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    preloadRazorpay();
    loadRazorpay();
  }, []);

  const userPrefill = useMemo(
    () => ({
      name: 'Atlas Guest',
      email: 'guest@example.com',
      contact: '+919999999999',
    }),
    [],
  );

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

  const handleDateChange = (ranges: any) => {
    markEngagement();
    const { startDate, endDate } = ranges.selection;
    setHasInteractedWithDates(true);
    setInlineStatus('Dates updated for your stay.');
    const normalizedStart = startDate ? startOfDay(startDate) : defaultStartDate;
    const normalizedEnd = endDate ? startOfDay(endDate) : defaultEndDate;
    const effectiveStartDate = normalizedStart < today ? defaultStartDate : normalizedStart;
    let resolvedEndDate = normalizedEnd <= effectiveStartDate ? addDays(effectiveStartDate, 1) : normalizedEnd;

    if (startDate && endDate) {
      if (effectiveStartDate.getTime() === normalizedEnd.getTime()) {
        resolvedEndDate = addDays(effectiveStartDate, 1);
      }

      setDates({
        startDate: effectiveStartDate,
        endDate: resolvedEndDate,
        key: 'selection',
      });

      trackEvent(
        'booking_dates_changed',
        {
          surface: 'booking_form',
          startDate: effectiveStartDate.toISOString(),
          endDate: resolvedEndDate.toISOString(),
        },
        { propertyId, listingId: propertyId, unitCode: propertyId },
      );

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
    }
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
      if (guestMenuRef.current && !guestMenuRef.current.contains(event.target)) {
        setOpenGuests(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setOpenCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchBookedDates = async () => {
      setIsBookedDatesLoading(true);
      try {
        const response = await api.get(`/bookings/${propertyId}`);
        const bookings = asArray(response.data);

        const datesArray: Date[] = [];
        bookings.forEach((booking: any) => {
          const start = new Date(booking.startDate);
          const end = new Date(booking.endDate);

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            datesArray.push(new Date(d));
          }
        });

        setBookedDates(datesArray);
      } catch (error) {
        console.error('Failed to fetch booked dates:', error);
      } finally {
        setIsBookedDatesLoading(false);
      }
    };

    fetchBookedDates();
  }, [propertyId]);

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
      const min = guestLimits[type].min ?? 0;
      const max = guestLimits[type].max;
      const proposedValue = prev[type] + (increment ? 1 : -1);

      if (!increment && proposedValue < min) return prev;
      if (increment && typeof max === 'number' && proposedValue > max) return prev;

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

  const isAtMin = (type: GuestCountKey) => guests[type] <= (guestLimits[type].min ?? 0);
  const isAtMax = (type: GuestCountKey) =>
    typeof guestLimits[type].max === 'number' &&
    guests[type] >= (guestLimits[type].max ?? Number.MAX_SAFE_INTEGER);

  const primaryCtaLabel = hasSelection && termsAccepted ? 'Book now' : 'Check availability';
  const inlineCtaLabel = hasSelection ? 'Check availability' : 'Select dates';
  const isCheckoutInvalid = dates.endDate <= dates.startDate;
  const guestNeedsAdult = guests.adults < 1;
  const containerPaddingBottom = supportPadding ? 'pb-40' : 'pb-28';
  const validationMessageId = useId();
  const checkOutErrorId = useId();
  const guestErrorId = useId();
  const validationMessage = useMemo(() => {
    if (isCheckoutInvalid) return 'Check-out must be after check-in.';
    if (guestNeedsAdult) return 'Add at least one adult.';
    return '';
  }, [guestNeedsAdult, isCheckoutInvalid]);
  const inlineCtaDisabled = !hasSelection || isCheckoutInvalid;
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
    ? 'grid grid-cols-1 items-stretch gap-3 p-3 sm:grid-cols-2 lg:]'
    : 'grid grid-cols-1 items-stretch gap-3 p-3 md:grid-cols-4';
  const fieldButtonClass =
    'group flex h-full min-h-[4.5rem] flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface/70 px-4 text-left text-text-primary shadow-inner transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary';
  const helperTextClass = 'mt-1 text-xs font-semibold text-text-muted leading-snug';

  const handleInlineCta = () => {
    markEngagement();
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

  const initiatePayment = async () => {
    markEngagement();
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

    if (!termsAccepted) {
      alert('Please confirm the Terms & Conditions before reserving.');
      return;
    }

    setIsLoading(true);
    setPaymentStatus({ state: 'idle' });

    const scriptReady = await loadRazorpay();
    if (!scriptReady) {
      setIsLoading(false);
      alert('Payment gateway could not be initialized. Please check your connection and try again.');
      return;
    }

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

    const razorpayOptions = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      amount: totalPrice * 100,
      currency: 'INR',
      name: property?.property_name || 'Atlas Homestays',
      description: 'Secure checkout powered by Razorpay',
      notes: {
        termsAcceptedAt: acceptedAt,
        propertyId: propertyId,
        nights,
        bookingId,
        checkIn: bookingSummary.checkIn,
        checkOut: bookingSummary.checkOut,
        guests: bookingSummary.guests,
      },
      prefill: {
        ...userPrefill,
      },
      theme: {
        color: ctaPrimaryColor,
      },
      handler: (response: any) => {
        setPaymentStatus({
          state: 'success',
          paymentId: response.razorpay_payment_id,
          bookingId,
        });
        setCtaConfirmation('Payment received. We are confirming your stay.');
        setIsLoading(false);
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
        ondismiss: () => {
          setIsLoading(false);
        },
      },
    };

    const razorpay = new window.Razorpay(razorpayOptions);
    razorpay.open();
    razorpay.on('payment.failed', (response: any) => {
      const failureReason = response.error?.description || 'Payment could not be completed.';
      setPaymentStatus({
        state: 'failure',
        reason: `${failureReason} Please try again or choose a different method.`,
      });
      setCtaConfirmation(failureReason);
      setIsLoading(false);
      trackEvent(
        'payment_failed',
        { surface: 'booking_form', bookingId, reason: failureReason },
        { propertyId, listingId: propertyId, unitCode: propertyId },
      );
    });
  };

  return (
    <div
      id="booking-form"
      className={`max-w-md mx-auto p-6 bg-bg-surface shadow-level2 rounded-2xl relative ${containerPaddingBottom} lg:pb-0 lg:sticky lg:top-20`}
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
        validationMessage={validationMessage}
        validationMessageId={validationMessageId}
        setHasInteractedWithDates={setHasInteractedWithDates}
        isCheckoutInvalid={isCheckoutInvalid}
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
        isBookedDatesLoading={isBookedDatesLoading}
        bookedDates={bookedDates}
        DateRangeComponent={undefined as never}
        handleDateChange={handleDateChange}
        defaultStartDate={defaultStartDate}
        ctaPrimaryColor={ctaPrimaryColor}
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
        guestLimits={guestLimits}
        updateChildAge={updateChildAge}
        markEngagement={markEngagement}
        setOpenGuests={setOpenGuests}
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
        inlinePolicySnippets={inlinePolicySnippets}
        isRazorpayReady={isRazorpayReady}
        isLoading={isLoading}
        termsAccepted={termsAccepted}
        setTermsAccepted={setTermsAccepted}
        termsAcceptedAt={termsAcceptedAt}
        setTermsAcceptedAt={setTermsAcceptedAt}
        initiatePayment={initiatePayment}
        primaryCtaLabel={primaryCtaLabel}
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
      />
    </div>
  );
};

export default BookingCard;
