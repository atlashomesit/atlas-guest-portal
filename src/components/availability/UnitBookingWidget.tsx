
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, startOfMonth } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';import { doesRangeIntersectBlocked, toISODate } from '@/utils/dateRange';
import { calculateNightlyPrice, inferUnitType } from '@/utils/pricing';
import priceDisplayConfig from '@/config/priceDisplay.config';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import { fetchCalendarPricing } from '@/api/pricingClient';

declare global {
  interface Window {
    Razorpay: new (...args: unknown[]) => { open: (options: unknown) => void };
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

/** Map API error to actionable guest-facing message (quote/availability/payment/duplicate). */
function getBookingErrorMessage(error: unknown, context: 'order' | 'verify'): string {  const status = (error as { response?: { status?: number } })?.response?.status;
  const data = (error as { response?: { data?: { message?: string } } })?.response?.data;
  const message = (typeof data?.message === 'string' ? data.message : '') || (error as Error)?.message || '';

  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('quote') && (lower.includes('invalid') || lower.includes('expired'))) {
    return 'Your quote has expired. Please select dates again and complete the booking.';
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
  return context === 'order'
    ? 'We couldn\'t start checkout. Please check your dates and try again, or contact support.'
    : 'Payment verification failed. Please contact support with your payment ID.';
}

const UnitBookingWidget: React.FC<UnitBookingWidgetProps> = ({ listingId, propertyId, listingName }) => {  if (import.meta.env.DEV) {
    console.assert(Boolean(propertyId), '[UnitBookingWidget] propertyId is required for unit mode');
  }

  const navigate = useNavigate();
  const _location = useLocation();
  const { updateBooking } = useBooking();
  const isBookingDisabled = !hasRuntimeConfig();

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
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | null>(null);
  const [bookingDetails, setBookingDetails] = useState<{
    bookingId: string;
    amount: number;
    propertyName: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    email: string;
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

    if (isSubmitting) return;

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
    } catch {
      setFormError('Unable to start checkout. Please try again later.');
      return;
    }

    const numericListingId = listingId != null ? Number(listingId) : NaN;
    if (!Number.isFinite(numericListingId)) {
      setFormError('Property could not be loaded. Please refresh the page and try again.');
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
        listingId: numericListingId,
        checkinDate: toISODate(normalizedCheckin),  // Format as YYYY-MM-DD
        checkoutDate: toISODate(normalizedCheckout),  // Format as YYYY-MM-DD
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

      // 3. Create Razorpay order      const orderResponse = await axios.post(orderUrl, orderPayload, {
        headers: {
          ...getApiHeaders(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }      });

      const { keyId: key, orderId, bookingId } = orderResponse.data;

      // 4. Load Razorpay script and open checkout
      loadRazorpayScript(() => {
        try {
          let paymentCompleted = false; // Track if payment handler was called
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
              ondismiss: () => {
                // Handle modal close/exit (when user clicks "Yes, exit" or closes the modal)
                // Only show failed popup if payment wasn't completed (user cancelled/exited)
                if (!paymentCompleted) {
                  setPaymentStatus('failed');
                  setFormError('Payment was cancelled. Please try again to complete your booking.');
                  setIsLoading(false);
                }
              }
            },
            handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
              paymentCompleted = true; // Mark payment as completed              try {
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
                  amount: finalTotal,
                  propertyName: listingName || 'Selected Property',
                  checkIn: checkinDate,
                  checkOut: checkoutDate,
                  nights,
                  email: formData.email.trim()
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
              } finally {                setIsLoading(false);
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (response: { error?: { description?: string } }) => {
            paymentCompleted = true; // Payment attempt was made
            setPaymentStatus('failed');
            setFormError(`Payment failed: ${response.error?.description || 'Unknown error'}`);
            setIsLoading(false);
          });
          rzp.open();
        } catch (error) {
          console.error('Error initializing Razorpay:', error);
          setFormError('Failed to initialize payment. Please try again.');
          setIsLoading(false);        }
      });
    } catch (error: unknown) {
      console.error('Booking error:', error);
      setFormError(getBookingErrorMessage(error, 'order'));
      setIsLoading(false);    }
  };

  const closePaymentPopup = useCallback(() => {
    setPaymentStatus(null);
  }, []);

  const goToDashboard = useCallback(() => {
    closePaymentPopup();
    navigate('/', { replace: true });
  }, [navigate, closePaymentPopup]);

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
    }, [closePaymentPopup]);


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
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(bookingDetails.amount)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Property</span>
                  <p className="text-base font-semibold text-gray-900">{bookingDetails.propertyName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Check-in</span>
                    <p className="text-base font-semibold text-gray-900">{format(bookingDetails.checkIn, 'EEE, dd MMM yyyy')}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">Check-out</span>
                    <p className="text-base font-semibold text-gray-900">{format(bookingDetails.checkOut, 'EEE, dd MMM yyyy')}</p>
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
                Go to Dashboard
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
        if (e.key === 'Escape') closePaymentPopup();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [closePaymentPopup]);
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePaymentPopup();        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[70vh] overflow-hidden animate-in zoom-in-95 duration-200 relative">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPaymentStatus(null);            }}
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
            <div className="text-center text-xs text-gray-500 space-y-1">              <p>Call: +91-7032493290</p>
              <p>Email: atlashomeskphb@gmail.com</p>
              <p>Live Chat Available</p>
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
