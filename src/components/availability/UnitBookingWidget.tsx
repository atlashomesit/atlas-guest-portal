
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
  const isBookingDisabled = !isApiBaseConfigured();

  const today = useMemo(() => getIstStartOfDay(), []);
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
  const [dateStatusMap, setDateStatusMap] = useState<Map<string, 'Blocked' | 'Available' | 'Hold'>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastAvailabilityKeyRef = useRef<string | null>(null);
  const hasAutoAdjustedRef = useRef(false);
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

  // Availability range always starts from today, independent of selected dates or shown date
  const availabilityRange = useMemo(() => {
    const startDate = today; // Always start from today
    const endDate = addDays(startDate, 60);
    return { startDate, endDate };
  }, [today]);

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

  useEffect(() => {
    if (!openCalendar) {
      lastAvailabilityKeyRef.current = null;
    }
  }, [openCalendar, listingId]);

  // Reset auto-adjust flag when listing changes
  useEffect(() => {
    hasAutoAdjustedRef.current = false;
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
      } catch (error) {
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
        url.searchParams.set('endDate', toISODate(getIstStartOfDay(availabilityRange.endDate)));

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

const isCheckOutAllowed = (date: Date) => {
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

  const startISO = toISODate(getIstStartOfDay(startDate));
  const endISO = toISODate(getIstStartOfDay(endDate));

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
      return;
    }
    setDateError('These dates overlap an existing booking or hold.');
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
      // Build the full API URL using buildApiUrl to ensure it calls the correct endpoint
      let blocksApiUrl: string;
      try {
        blocksApiUrl = buildApiUrl('/availability/blocks');
      } catch (error) {
        setFormError('Availability service is unavailable. Please try again later.');
        setIsLoading(false);
        return;
      }
      
      const response = await apiFetch(blocksApiUrl, {
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

    if (isBookingDisabled) {
      setFormError('Service temporarily unavailable. Please try again later.');
      return;
    }

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
    } catch (error) {
      setFormError('Unable to start checkout. Please try again later.');
      return;
    }

    setIsLoading(true);
    setFormError(null);
    setStatusMessage(null);

    try {
      // 1. Create booking draft
      // Normalize dates to IST start of day and format as YYYY-MM-DD (not full ISO string)
      const normalizedCheckin = getIstStartOfDay(checkinDate);
      const normalizedCheckout = getIstStartOfDay(checkoutDate);
      
      const bookingDraft = {
        listingId: Number(listingId),  // Ensure listingId is a number
        checkinDate: toISODate(normalizedCheckin),  // Format as YYYY-MM-DD
        checkoutDate: toISODate(normalizedCheckout),  // Format as YYYY-MM-DD
        guests,
        notes: ''
      };
      
      // Log the booking draft for debugging
      console.log('Booking draft:', {
        ...bookingDraft,
        listingIdType: typeof bookingDraft.listingId,
        checkinDateFormatted: bookingDraft.checkinDate,
        checkoutDateFormatted: bookingDraft.checkoutDate,
        checkinDateOriginal: checkinDate,
        checkoutDateOriginal: checkoutDate
      });

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
    } catch (error: any) {
      console.error('Booking error:', error);
      
      // Check if error is about dates not being available
      const errorMessage = error?.response?.data?.message || error?.message || '';
      if (errorMessage.includes('not available') || errorMessage.includes('Selected dates')) {
        setFormError('The selected dates are no longer available. Please select different dates.');
        // Optionally refresh availability data or reset date range
      } else {
        setFormError('Failed to process booking. Please try again.');
      }
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
              dayContentRenderer={(day) => {
                // Normalize all dates to IST start of day for consistent comparison
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
                const isToday = dayStart.getTime() === today.getTime();
                
                // Get status for this date (only for dates from today onwards)
                const status = dayStart.getTime() >= today.getTime() ? dateStatusMap.get(dayISO) : null;
                
                // Determine background color based on status
                let backgroundColor = '';
                if (status === 'Blocked') {
                  backgroundColor = 'bg-red-500';
                } else if (status === 'Available') {
                  backgroundColor = 'bg-green-500';
                } else if (status === 'Hold') {
                  backgroundColor = 'bg-orange-500';
                }

                return (
                  <div className="relative flex h-full w-full items-center justify-center">
                    {/* Background color based on status - show for all dates from today onwards */}
                    {/* Show with lower opacity when date is selected to not interfere with selection highlight */}
                    {status && backgroundColor && (
                      <div 
                        className={`absolute inset-0 rounded-lg ${backgroundColor}`}
                        style={{ 
                          margin: '2px', 
                          opacity: (isRangeStart || isRangeEnd || isInRange) ? 0.15 : 0.25
                        }}
                      />
                    )}
                    <span
                      className={`relative z-10 flex items-center justify-center text-sm font-medium transition ${
                        isRangeStart || isRangeEnd
                          ? 'bg-[var(--cta-primary)] text-white rounded-xl px-3 py-2 shadow-sm'
                          : isInRange
                          ? 'bg-[var(--cta-primary)]/20 text-[var(--cta-primary)] rounded-lg'
                          : isDisabled
                          ? isBlocked || status === 'Blocked' || status === 'Hold'
                            ? 'text-red-500/70 cursor-not-allowed'
                            : 'text-[var(--border-strong)] cursor-not-allowed opacity-50'
                          : status === 'Blocked' || (isBlocked && !status)
                          ? 'text-red-600 font-semibold cursor-not-allowed'
                          : status === 'Hold'
                          ? 'text-orange-600 font-semibold cursor-not-allowed'
                          : status === 'Available'
                          ? 'text-green-600 font-semibold'
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
