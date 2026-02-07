
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '@/components/date/AtlasDateRangePicker';
import { useBooking } from '@/contexts/BookingContext';
import { isApiBaseConfigured } from '@/lib/env';
import ErrorBanner from '@/components/ErrorBanner';
import { fetchAvailability, type AvailabilityNightlyRate, type AvailabilityResponse } from '@/api/availabilityClient';
import { buildApiUrl } from '@/api/client';
import { apiFetch } from '@/lib/http';
import { getIstStartOfDay } from '@/utils/date';
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';
import { doesRangeIntersectBlocked, parseISODate, toISODate } from '@/utils/dateRange';
import { calculateNightlyPrice, inferUnitType } from '@/utils/pricing';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface UnitBookingWidgetProps {
  listingId?: string | number;
  propertyId?: string | number;
  listingName?: string;
}

const normalizeListingId = (value: string | number | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const UnitBookingWidget: React.FC<UnitBookingWidgetProps> = ({ listingId, propertyId, listingName }) => {
  if (import.meta.env.DEV) {
    console.assert(Boolean(propertyId), '[UnitBookingWidget] propertyId is required for unit mode');
  }

  const navigate = useNavigate();
  const location = useLocation();
  const { updateBooking } = useBooking();
  const isBookingDisabled = import.meta.env.PROD && !isApiBaseConfigured();

  const today = getIstStartOfDay();
  const maxBookingDate = useMemo(() => addDays(today, 365), [today]);

  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);

  const [dateRange, setDateRange] = useState<AtlasDateRangePickerValue>({
    startDate: today,
    endDate: addDays(today, 1),
  });
  const [openCalendar, setOpenCalendar] = useState(false);
  const [shownDate, setShownDate] = useState<Date>(today);
  const [guests, setGuests] = useState(2);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isMounted = useRef(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const availabilityRange = useMemo(() => {
    const normalizedShownDate = getIstStartOfDay(shownDate);
    const startDate = normalizedShownDate < today ? today : normalizedShownDate;
    const endDate = addDays(startDate, 60);
    return { startDate, endDate };
  }, [shownDate, today]);

  const resolveNightlyRates = (
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

  // Fetch blocked dates when the component mounts or when the calendar is opened
  useEffect(() => {
    if (!openCalendar || !listingId || isBookingDisabled) return;

    const fetchBlockedDates = async () => {
      setIsLoading(true);
      setStatusMessage('Checking availability...');

      let availabilityBaseUrl: string;
      try {
        availabilityBaseUrl = buildApiUrl('/availability/listing-availability');
      } catch (error) {
        if (isMounted.current) {
          setIsLoading(false);
        }
        setStatusMessage('Availability service is unavailable. Please try again later.');
        return;
      }
      
      try {
        // Generate dates for the next 90 days
        const today = getIstStartOfDay();
        const dateArray = Array.from({ length: 90 }, (_, i) => addDays(today, i));
        
        const results = [];
        
        // Fetch availability for each date
        for (const date of dateArray) {
          try {
            const dateStr = toISODate(date);
            const url = new URL(availabilityBaseUrl);
            url.searchParams.set('listingId', String(listingId));
            url.searchParams.set('startDate', dateStr);

            const response = await apiFetch(url.toString());
            const data = await response.json();
            
            results.push({
              listingId: data.listingId,
              date: data.date,
              availableRooms: data.inventory > 0 ? 1 : 0
            });
          } catch (error) {
            console.error(`Failed to fetch availability for date ${date}:`, error);
          }
        }
        
        if (!isMounted.current) return;
        
        // Update blocked dates based on availability
        const newBlockedDates = new Set<string>();
        results.forEach(item => {
          if (item.availableRooms === 0) {
            const date = getIstStartOfDay(new Date(item.date));
            newBlockedDates.add(toISODate(date));
          }
        });
        
        setBlockedSet(newBlockedDates);
        setBookedDates(Array.from(newBlockedDates).map(date => new Date(date)));
        setStatusMessage(
          newBlockedDates.size > 0
            ? 'Some dates are unavailable due to existing bookings.'
            : 'All dates shown are available to book.'
        );
      } catch (error) {
        console.error('Error fetching blocked dates:', error);
        setStatusMessage('Failed to load availability. Please try again.');
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    fetchBlockedDates();
    
    return () => {
      isMounted.current = false;
    };
  }, [openCalendar, listingId]);
  const isCheckInAllowed = (date: Date) => {
  const iso = toISODate(getIstStartOfDay(date));
  if (blockedSet.has(iso)) return false; // blocked dates never check-in
  // Allow check-in if previous date is blocked or it's today
  const prevDayISO = toISODate(addDays(date, -1));
  if (blockedSet.has(prevDayISO)) return true;
  return true; // otherwise normal
};

const isCheckOutAllowed = (date: Date) => {
  const iso = toISODate(getIstStartOfDay(date));
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
  if (normalized < today) return true;

  const iso = toISODate(normalized);

  // Allow check-out for blocked date if it's right after startDate
  if (dateRange.startDate) {
    const nextDay = addDays(dateRange.startDate, 1);
    if (normalized.getTime() === nextDay.getTime() && blockedSet.has(iso)) {
      return false; // allow check-out
    }
  }

  return blockedSet.has(iso); // block all other blocked dates
}, [blockedSet, today, dateRange.startDate]);

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

  const startISO = toISODate(getIstStartOfDay(startDate));
  const endISO = toISODate(getIstStartOfDay(endDate));

  // Prevent blocked ranges
  if (doesRangeIntersectBlocked(startISO, endISO, blockedSet)) {
    // Exception: allow single-day checkout if blocked
    const prevDay = addDays(startDate, 1);
    if (
      endDate.getTime() === prevDay.getTime() &&
      blockedSet.has(toISODate(endDate))
    ) {
      setDateRange({ startDate, endDate });
      return;
    }
    setDateError('These dates overlap an existing booking.');
    return;
  }

  setDateRange(next);
};


  const calculatePrice = () => {
    const unitType = inferUnitType({ id: propertyId, property_name: listingName });
    const includedGuests = 2;
    
    // Calculate number of nights
    const nights = dateRange.startDate && dateRange.endDate 
      ? calculateNights(dateRange.startDate, dateRange.endDate) 
      : 1; // Default to 1 night if no dates selected
    
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
      hasSpecialDateMultiplier
    };
  };

  const priceDetails = calculatePrice();
  // ---------- Fee calculations ----------
  
  // GST = 5% on discounted price
  const gstAmount = 0;
  
  // Convenience fee = 2.7% of (total + GST)
  const subtotalForConvenience = priceDetails.total + gstAmount;
  const convenienceFee = Math.round(subtotalForConvenience * 0.027);
  
  // Final payable amount (without cleaning fee)
  const finalTotal = priceDetails.total + gstAmount + convenienceFee;


  const formattedDateLabel = dateRange.startDate && dateRange.endDate
    ? `${format(dateRange.startDate, 'EEE, dd MMM')} – ${format(dateRange.endDate, 'EEE, dd MMM')} • ${priceDetails.nights} ${priceDetails.nights === 1 ? 'night' : 'nights'}`
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
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
      isValid = false;
    }

    if (!formData.phone) {
      errors.phone = 'Phone number is required';
      isValid = false;
    } else if (!/^\d{10}$/.test(formData.phone)) {
      errors.phone = 'Phone number must be 10 digits';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendSelectedDates = async () => {
    if (isBookingDisabled) {
      setFormError('Service temporarily unavailable. Please try again later.');
      return;
    }

    if (!listingId) {
      console.error('No listing ID available');
      return;
    }
    
    if (!dateRange.startDate || !dateRange.endDate) {
      setFormError('Please select both start and end dates');
      return;
    }
    
    setIsLoading(true);
    setFormError(null);
    
    try {
      const response = await apiFetch('/availability/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: Number(listingId),
          startDate: toISODate(getIstStartOfDay(dateRange.startDate)),
          endDate: toISODate(getIstStartOfDay(dateRange.endDate))
        })
      });
      
      const result = await response.json();
      console.log('Dates submitted successfully:', result);
      
    } catch (error) {
      console.error('Error submitting selected dates:', error);
      setFormError('Failed to save selected dates. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
      setFormError('Failed to load payment processor. Please try again.');
      setIsLoading(false);
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

      if (!isApiBaseConfigured()) {
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

      console.log('Sending payment verification request:', requestData);

      const response = await axios.post(buildApiUrl('/api/Razorpay/verify'), requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Verification response:', response.data);
      
      if (response.data.success) {
        setStatusMessage('Payment successful! Your booking is confirmed.');
      } else {
        throw new Error(response.data.message || 'Payment verification failed');
      }
    } catch (error: any) {
      console.error('Payment verification error:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      const errorMessage = error.response?.data?.message || 
                         error.message || 
                         'Payment verification failed';
      
      setFormError(`Payment verification failed: ${errorMessage}. Please contact support with payment ID: ${paymentData.razorpay_payment_id}`);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBookingDisabled) {
      setFormError('Service temporarily unavailable. Please try again later.');
      return;
    }
    
    if (!dateRange.startDate || !dateRange.endDate) {
      setFormError('Please select check-in and check-out dates.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    let orderUrl: string;
    try {
      orderUrl = buildApiUrl('/api/Razorpay/order');
    } catch (error) {
      setFormError('Unable to start checkout. Please try again later.');
      return;
    }

    setIsLoading(true);
    setFormError(null);
    setStatusMessage(null);

    try {
      // 1. Create booking draft
      const bookingDraft = {
        listingId: String(listingId),
        checkinDate: dateRange.startDate.toISOString(),
        checkoutDate: dateRange.endDate.toISOString(),
        guests,
        notes: ''
      };

      // 2. Prepare order payload with the exact structure expected by the backend
      const orderPayload = {
        bookingDraft: {
          listingId: bookingDraft.listingId,
          checkinDate: bookingDraft.checkinDate,
          checkoutDate: bookingDraft.checkoutDate,
          guests: bookingDraft.guests,
          notes: bookingDraft.notes || ''
        },
        amount: Math.round(finalTotal), // Keep amount in rupees, let backend handle conversion if needed
        currency: 'INR',
        guestInfo: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim().replace(/\D/g, '').substring(0, 10)
        }
      };
      
      console.log('Sending order payload:', JSON.stringify(orderPayload, null, 2));

      // 3. Create Razorpay order
      const orderResponse = await axios.post(orderUrl, orderPayload);

      const { keyId: key, orderId, bookingId } = orderResponse.data;

      // 4. Load Razorpay script and open checkout
      loadRazorpayScript(() => {
        try {
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
            handler: async (response: any) => {
              try {
                await verifyPayment({
                  bookingId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                });
                
                // Update booking context on success
                updateBooking({
                  propertyId: propertyId ?? undefined,
                  propertyName: listingName ?? undefined,
                  checkIn: dateRange.startDate?.toISOString() ?? '',
                  checkOut: dateRange.endDate?.toISOString() ?? '',
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
                setFormError('Failed to verify payment. Please contact support.');
              } finally {
                setIsLoading(false);
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (response: any) => {
            setFormError(`Payment failed: ${response.error.description || 'Unknown error'}`);
            setIsLoading(false);
          });

          rzp.open();
        } catch (error) {
          console.error('Error initializing Razorpay:', error);
          setFormError('Failed to initialize payment. Please try again.');
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Booking error:', error);
      setFormError('Failed to process booking. Please try again.');
      setIsLoading(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6 space-y-5">

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
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-text-primary">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceDetails.total)}
          </span>
          <span className="text-sm text-text-muted line-through">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceDetails.subtotal)}
          </span>
          <span className="text-sm font-semibold text-[color:color-mix(in_srgb,var(--cta-primary)_80%,transparent)]">
            Save 17%
          </span>
        </div>
        <div className="text-sm text-text-muted space-y-1 mt-1">
          <p>{priceDetails.nights} {priceDetails.nights === 1 ? 'night' : 'nights'} × {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceDetails.basePrice / priceDetails.nights)}</p>
          {priceDetails.extraGuests > 0 && (
            <p>{priceDetails.extraGuests} {priceDetails.extraGuests === 1 ? 'extra guest' : 'extra guests'} × {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(priceDetails.extraGuestsFee / priceDetails.nights / priceDetails.extraGuests)}/night</p>
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
              // Update shown date to the selected start date when opening calendar
              if (dateRange.startDate) {
                setShownDate(getIstStartOfDay(dateRange.startDate));
              }
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
          <div className="unit-datepicker-wrapper">
            <AtlasDateRangePicker
              anchorRef={calendarButtonRef}
              open={openCalendar}
              onClose={() => setOpenCalendar(false)}
              value={dateRange}
              onChange={handleRangeChange}
              loading={isLoading}
              minDate={addDays(today, -1)}
              maxDate={maxBookingDate}
              disabledDay={disabledDay}
              months={2}
              shownDate={shownDate}
              onShownDateChange={(date) => {
                setShownDate(startOfMonth(date));
              }}
              loadingLabel="Loading availability"
              rangeColors={['#475569']}
              dayContentRenderer={(day) => {
                // Normalize all dates to IST start of day for consistent comparison
                const dayStart = getIstStartOfDay(day);
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
                const isBlocked = blockedSet.has(toISODate(dayStart));
                const isDisabled = disabledDay(day);
                const isToday = dayStart.getTime() === today.getTime();

                return (
                  <div className="relative flex h-full w-full items-center justify-center">
                    {isBlocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute w-full h-px bg-red-500 transform rotate-45 origin-center" style={{ transform: 'rotate(-45deg)' }}></div>
                      </div>
                    )}
                    <span
                      className={`relative z-10 flex items-center justify-center text-sm font-medium transition ${
                        isRangeStart || isRangeEnd
                          ? 'bg-[var(--cta-primary)] text-white rounded-xl px-3 py-2 shadow-sm'
                          : isDisabled
                          ? isBlocked
                            ? 'text-red-500/70 cursor-not-allowed'
                            : 'text-[var(--border-strong)] cursor-not-allowed opacity-50'
                          : 'text-[var(--brand)]'
                      }`}
                      style={{ minHeight: 38, minWidth: 38 }}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                );

              }}
            />
          </div>
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
                className="!px-2 !py-2 h-9 w-9"
                aria-label="Decrease guests"
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
                className="!px-2 !py-2 h-9 w-9"
                aria-label="Increase guests"
                onClick={() => setGuests((current) => Math.min(16, current + 1))}
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

  <div className="space-y-1.5 text-text-secondary">
    
    <div className="grid grid-cols-[140px_12px_1fr]">
      <span>Price</span>
      <span>:</span>
      <span className="text-right">
        {new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(priceDetails.total)}
      </span>
    </div>

    <div className="grid grid-cols-[140px_12px_1fr]">
      <span>GST (5%)</span>
      <span>:</span>
      <span className="text-right">
        {new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(gstAmount)}
      </span>
    </div>

    <div className="grid grid-cols-[140px_12px_1fr]">
      <span>Convenience fee</span>
      <span>:</span>
      <span className="text-right">
        {new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(convenienceFee)}
      </span>
    </div>
  </div>

  <div className="mt-3 border-t border-border-subtle pt-3 grid grid-cols-[140px_12px_1fr] text-base font-semibold text-text-primary">
    <span>Total</span>
    <span>:</span>
    <span className="text-right">
      {new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(finalTotal)}
    </span>
  </div>
</div>

      </div>

      {/* Selected Dates Button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleSendSelectedDates}
          disabled={!dateRange.startDate || !dateRange.endDate || isLoading || isBookingDisabled}
          className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
            !dateRange.startDate || !dateRange.endDate || isLoading || isBookingDisabled
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isBookingDisabled ? 'Unavailable' : isLoading ? 'Sending...' : 'Selected'}
        </button>
        {dateRange.startDate && dateRange.endDate && (
          <p className="mt-2 text-sm text-center text-text-secondary">
            {format(dateRange.startDate, 'MMM d')} - {format(dateRange.endDate, 'MMM d, yyyy')}
            {' • '}
            {calculateNights(dateRange.startDate, dateRange.endDate)} {
              calculateNights(dateRange.startDate, dateRange.endDate) === 1 ? 'night' : 'nights'
            }
          </p>
        )}
      </div>

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
          />
          {formErrors.name && <p className="text-sm text-support-error">{formErrors.name}</p>}
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
          />
          {formErrors.email && <p className="text-sm text-support-error">{formErrors.email}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary" htmlFor="phone">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            disabled={isBookingDisabled}
            className={`w-full rounded-xl border ${formErrors.phone ? 'border-support-error' : 'border-border-strong'} bg-bg-muted px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-cta-primary`}
            placeholder="Enter your 10-digit phone number"
          />
          {formErrors.phone && <p className="text-sm text-support-error">{formErrors.phone}</p>}
        </div>
      </div>

      {formError && <p className="text-sm text-support-error">{formError}</p>}

      <Button 
        type="submit" 
        fullWidth 
        onClick={handleSubmit} 
        disabled={isLoading || !dateRange.startDate || !dateRange.endDate || isBookingDisabled}
        className={isLoading ? 'opacity-75' : ''}
      >
        {isBookingDisabled ? 'Unavailable' : isLoading ? 'Processing...' : 'Book this home'}
      </Button>
    </form>
  );
};

export default UnitBookingWidget;
