import { useState, useRef, useEffect, useMemo } from 'react';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import { api, asArray } from '@/lib/api';
import { propertyData } from '../../../data';
import { inlinePolicySnippets } from '../../../content/terms';
import { baseGuestAllowance, getUnitPolicy } from '../../../config/policyConfig';
import { FaCcMastercard, FaCcVisa, FaCreditCard, FaUserFriends } from 'react-icons/fa';
import { SiGooglepay, SiRazorpay } from 'react-icons/si';
import { trackEvent } from '../../../utils/analytics';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { priceDisplayConfig } from '../../../config/priceDisplay.config';

declare global {
  interface Window {
    Razorpay: any;
  }
}

import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface BookingCardProps {
    propertyId: number;
    supportPadding?: boolean;
}

type GuestCountKey = 'adults' | 'children' | 'infants' | 'pets';

const guestLimits: Record<GuestCountKey, { min: number; max?: number }> = {
    adults: { min: 0, max: 10 },
    children: { min: 0, max: 10 },
    infants: { min: 0, max: 2 },
    pets: { min: 0, max: 4 },
};

const BookingCard: React.FC<BookingCardProps> = ({ propertyId, supportPadding = false }) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openGuests, setOpenGuests] = useState(false);
    const [bookedDates, setBookedDates] = useState<Date[]>([]);
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
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000), // Next day by default
        key: "selection",
    });
    
    const handleDateChange = (ranges: any) => {
        const { startDate, endDate } = ranges.selection;
        setHasInteractedWithDates(true);
        
        // Always update the dates when a selection is made
        if (startDate && endDate) {
            // If the same date is selected for both start and end, set end to next day
            if (startDate.getTime() === endDate.getTime()) {
                const nextDay = new Date(startDate);
                nextDay.setDate(nextDay.getDate() + 1);
                setDates({
                    startDate: startDate,
                    endDate: nextDay,
                    key: 'selection'
                });
            } else {
                setDates({
                    startDate: startDate,
                    endDate: endDate,
                    key: 'selection'
                });
            }

            const selectedNights = Math.max(1, Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)));
            trackEvent(
                'dates_selected',
                {
                    surface: 'booking_form',
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    nights: selectedNights,
                    guests: totalPeople,
                },
                { propertyId, listingId: propertyId, unitCode: propertyId },
            );
        }
    };

    interface GuestCounts {
        adults: number;
        children: number;
        childrenAges: number[]; // To track ages of children (5-12)
        infants: number; // 0-5 years
        pets: number;
    }

    const [guests, setGuests] = useState<GuestCounts>({
        adults: 1, // Start with 1 adult by default
        children: 0,
        childrenAges: [],
        infants: 0,
        pets: 0,
    });

    // Convert propertyId to number if it's passed as a string
    const property = propertyData.find(p => p.id === Number(propertyId));
    const unitType = inferUnitType({ id: property?.id, property_name: property?.property_name });
    
    // Calculate total number of people (adults + children)
    const totalPeople = guests.adults + guests.children;
    
    // Calculate number of nights (minimum 1 night)
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

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
        ? "inline-flex items-center rounded-full bg-[color:var(--bg-muted)] px-3 py-1 text-xs font-semibold text-cta-primary text-center"
        : "inline-flex items-center rounded-full bg-[color:color-mix(in_srgb,var(--cta-primary)_12%,transparent)] px-3 py-1 text-xs font-semibold text-cta-primary text-center";
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

    const preloadRazorpay = () => {
        const existingPreload = document.querySelector("link[rel='preload'][href='https://checkout.razorpay.com/v1/checkout.js']");
        if (!existingPreload) {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'script';
            preloadLink.href = 'https://checkout.razorpay.com/v1/checkout.js';
            document.head.appendChild(preloadLink);
        }

        const existingPreconnect = document.querySelector("link[rel='preconnect'][href='https://checkout.razorpay.com']");
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

            const existingScript = document.querySelector("script[src='https://checkout.razorpay.com/v1/checkout.js']") as HTMLScriptElement | null;
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

    const userPrefill = useMemo(() => ({
        name: 'Atlas Guest',
        email: 'guest@example.com',
        contact: '+919999999999',
    }), []);

    const bookingSummary = useMemo(() => ({
        propertyName: property?.property_name || 'Atlas Homestays',
        checkIn: format(dates.startDate, 'dd MMM yyyy'),
        checkOut: format(dates.endDate, 'dd MMM yyyy'),
        guests: formatGuestLabel(),
        nights,
        total: totalPrice,
    }), [property?.property_name, dates.startDate, dates.endDate, nights, totalPrice, guests]);

    const initiatePayment = async () => {
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
            setIsLoading(false);
                trackEvent(
                    'payment_failed',
                    { surface: 'booking_form', bookingId, reason: failureReason },
                    { propertyId, listingId: propertyId, unitCode: propertyId },
                );
        });
    };

    const unitPolicy = getUnitPolicy(propertyId);


    const updateChildAge = (index: number, age: number) => {
        const newAges = [...guests.childrenAges];
        newAges[index] = age;
        setGuests(prev => ({
            ...prev,
            childrenAges: newAges
        }));
    };

    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (
                guestMenuRef.current &&
                !guestMenuRef.current.contains(event.target)
            ) {
                setOpenGuests(false);
            }
            if (
                calendarRef.current &&
                !calendarRef.current.contains(event.target)
            ) {
                setOpenCalendar(false);
            }
        };
      document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
     

useEffect(() => {
    const fetchBookedDates = async () => {
        try {
            // Replace `{id}` with your propertyId
            const response = await api.get(`/bookings/${propertyId}`);
            // Assuming your API returns an array of bookings with startDate and endDate
            const bookings = asArray(response.data);

            const dates: Date[] = [];
            bookings.forEach((booking: any) => {
                const start = new Date(booking.startDate);
                const end = new Date(booking.endDate);

                // Fill all dates in the range
                for (
                    let d = new Date(start);
                    d <= end;
                    d.setDate(d.getDate() + 1)
                ) {
                    dates.push(new Date(d));
                }
            });

            setBookedDates(dates);
        } catch (error) {
            console.error("Failed to fetch booked dates:", error);
        }
    };

    fetchBookedDates();
}, [propertyId]);

    const modifyGuest = (type: GuestCountKey, increment: boolean) => {
        setGuests(prev => {
            const min = guestLimits[type].min ?? 0;
            const max = guestLimits[type].max;
            const proposedValue = prev[type] + (increment ? 1 : -1);

            if (!increment && proposedValue < min) return prev;
            if (increment && typeof max === 'number' && proposedValue > max) return prev;

            return {
                ...prev,
                [type]: Math.max(min, proposedValue),
            };
        });
    };

    const isAtMin = (type: GuestCountKey) => guests[type] <= (guestLimits[type].min ?? 0);
    const isAtMax = (type: GuestCountKey) =>
        typeof guestLimits[type].max === 'number' && guests[type] >= (guestLimits[type].max ?? Number.MAX_SAFE_INTEGER);

    const hasSelection = Boolean(dates.startDate && dates.endDate && guests.adults);
    const primaryCtaLabel = hasSelection && termsAccepted ? 'Book now' : 'Check availability';
    const inlineCtaLabel = hasSelection ? 'Check availability' : 'Select dates';
    const isCheckoutInvalid = dates.endDate <= dates.startDate;
    const guestNeedsAdult = guests.adults < 1;
    const containerPaddingBottom = supportPadding ? 'pb-40' : 'pb-28';

    const handleInlineCta = () => {
        setHasInteractedWithDates(true);
        setOpenCalendar(false);
        setOpenGuests(false);
        if (typeof document !== 'undefined') {
            document.getElementById('pricing-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div id="booking-form" className={`max-w-md mx-auto p-6 bg-bg-surface shadow-level2 rounded-2xl relative ${containerPaddingBottom} lg:pb-0 lg:sticky lg:top-20`}>

            {/* PRICE SECTION */}
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                        {hasDiscountToShow && (
                            <span className="text-sm font-medium text-text-muted line-through">
                                ₹{baseNightlyRate.toLocaleString("en-IN")}
                            </span>
                        )}
                        <p className="text-[30px] font-bold text-cta-primary leading-none">
                            ₹{averageNightlyRate.toLocaleString("en-IN")}
                            <span className="text-base font-semibold ml-1 text-text-muted">/night</span>
                        </p>
                    </div>
                    <p className="text-sm text-text-muted">
                        {hasSpecialPricing ? "Average nightly with special-day pricing" : "Average nightly after discount"}
                    </p>
                    {hasDiscountToShow && nightlySavings > 0 && (
                        <p className="text-xs font-semibold text-cta-primary">
                            {priceDisplayConfig.discount.savingsPrefix} ₹{nightlySavings.toLocaleString("en-IN")} nightly
                        </p>
                    )}
                    {hasDiscountToShow && (
                        <p className="text-xs text-text-muted">
                            {priceDisplayConfig.discount.reasonLabel} · Discount ({discountPercentApplied}%)
                        </p>
                    )}
                </div>
                {(hasSpecialPricing || hasDiscountToShow) && (
                    <span className={`mt-1 ${priceBadgeClass}`}>
                        {hasSpecialPricing
                            ? specialPricingLabel || "Special day pricing"
                            : priceDisplayConfig.discount.primaryBadgeLabel || priceDisplayConfig.discount.secondaryBadgeLabel}
                    </span>
                )}
            </div>

            {property && (
                <div className="mb-4 space-y-1">
                    <p className="text-cta-primary text-sm font-semibold">★ {property.property_rating.toFixed(2)} ({property.property_reviews} reviews)</p>
                    {property.property_review_snippets?.[0] && (
                        <p className="text-sm text-text-primary italic">“{property.property_review_snippets[0]}”</p>
                    )}
                </div>
            )}

            <div className="mb-4 space-y-1 text-sm text-text-primary">
                <p>
                    Base price includes {baseGuestAllowance} guests; additional guests incur {unitPolicy.extraGuestFeeRange} per night (unit dependent).
                    <a className="underline ml-1" href="/terms#guests">See terms</a>
                </p>
                <p>
                    Check-in {unitPolicy.checkIn} · Check-out {unitPolicy.checkOut}.<a className="underline ml-1" href="/terms#check-in-check-out">Timings</a>
                </p>
            </div>


            <div className="mb-5 rounded-2xl border border-border-strong/60 bg-[color:color-mix(in_srgb,var(--bg-muted)_72%,var(--bg-surface))] shadow-inner">
                <div className="grid grid-cols-1 items-stretch gap-3 p-3 md:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => {
                            setOpenCalendar(true);
                            setOpenGuests(false);
                        }}
                        className="group flex h-full min-h-[4.5rem] flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface/70 px-4 text-left text-text-primary shadow-inner transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                    >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Check-in</span>
                        <span className="mt-1 text-base font-semibold text-text-primary">
                            {format(dates.startDate, "dd-MM-yyyy")}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setOpenCalendar(true);
                            setOpenGuests(false);
                            setHasInteractedWithDates(true);
                        }}
                        className="group flex h-full min-h-[4.5rem] flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface/70 px-4 text-left text-text-primary shadow-inner transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                    >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Check-out</span>
                        <span className="mt-1 text-base font-semibold text-text-primary">
                            {format(dates.endDate, "dd-MM-yyyy")}
                        </span>
                        {hasInteractedWithDates && isCheckoutInvalid && (
                            <span className="mt-1 text-xs font-semibold text-support-error">
                                Check-out must be after check-in.
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setOpenGuests(true);
                            setOpenCalendar(false);
                        }}
                        className="group flex h-full min-h-[4.5rem] flex-col justify-center rounded-xl border border-border-subtle bg-bg-surface/70 px-4 text-left text-text-primary shadow-inner transition hover:border-border-strong hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                    >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Guests</span>
                        <span className="mt-1 text-base font-semibold text-text-primary">{formatGuestLabel()}</span>
                        {guestNeedsAdult && (
                            <span className="mt-1 text-xs font-semibold text-support-error">
                                Add at least one adult.
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleInlineCta}
                        disabled={!hasSelection || isCheckoutInvalid}
                        className="flex h-full min-h-[4.5rem] items-center justify-center rounded-xl bg-cta-primary px-4 text-base font-semibold text-[var(--text-contrast)] shadow-level2 transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {inlineCtaLabel}
                    </button>
                </div>
            </div>

            {openCalendar && (
                <div ref={calendarRef} className="absolute right-0 z-[var(--z-overlay)] bg-bg-surface shadow-level2 rounded-xl mt-2 overflow-hidden border border-border-subtle">
                    <DateRange
                        editableDateInputs={true}
                        onChange={handleDateChange}
                        moveRangeOnFirstSelection={false}
                        ranges={[{
                            startDate: dates.startDate,
                            endDate: dates.endDate,
                            key: 'selection'
                        }]}
                        minDate={new Date()}
                        rangeColors={[ctaPrimaryColor]}
                        showDateDisplay={false}
                        showPreview={false}
                        showSelectionPreview={true}
                        months={1}
                        direction="horizontal"
                        className="text-sm"
                        monthDisplayFormat="MMMM yyyy"
                        weekdayDisplayFormat="EEEE"
                        dayDisplayFormat="d"
                        disabledDates={bookedDates}
                    />
                </div>
            )}

            {/* UPDATED POPUP SECTION */}
            {openGuests && (
                <div
                    ref={guestMenuRef}
                    className="absolute left-1/2 -translate-x-1/2 bg-bg-surface z-[var(--z-overlay)] rounded-xl shadow-level2 border border-border-subtle p-4 overflow-y-auto"
                    style={{
                        width: '90%',          // Increased Width
                        maxHeight: '200px',    // Reduced Height
                        top: '260px',
                    }}
                >
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-medium">Adults</p>
                                <p className="text-sm text-text-muted">Age 14 or above</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => modifyGuest("adults", false)}
                                    disabled={isAtMin("adults")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    -
                                </button>
                                <span>{guests.adults}</span>
                                <button
                                    onClick={() => modifyGuest("adults", true)}
                                    disabled={isAtMax("adults")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-medium">Children</p>
                                <p className="text-sm text-text-muted">Ages 5-12</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        if (isAtMin("children")) return;
                                        setGuests(prev => ({
                                            ...prev,
                                            children: Math.max(guestLimits.children.min, prev.children - 1),
                                            childrenAges: prev.childrenAges.slice(0, -1)
                                        }));
                                    }}
                                    disabled={isAtMin("children")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    -
                                </button>
                                <span>{guests.children}</span>
                                <button
                                    onClick={() => {
                                        if (isAtMax("children")) return;
                                        setGuests(prev => {
                                            const nextChildren = prev.children + 1;
                                            const cappedValue =
                                                typeof guestLimits.children.max === 'number'
                                                    ? Math.min(guestLimits.children.max, nextChildren)
                                                    : nextChildren;
                                            return {
                                                ...prev,
                                                children: cappedValue,
                                                childrenAges: [...prev.childrenAges, 5] // Default age 5
                                            };
                                        });
                                    }}
                                    disabled={isAtMax("children")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {guests.childrenAges.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {guests.childrenAges.map((age, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <span className="text-sm">Child {index + 1}:</span>
                                        <select
                                            value={age}
                                            onChange={(e) => updateChildAge(index, parseInt(e.target.value))}
                                            className="border rounded p-1 text-sm w-20"
                                        >
                                            {[5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                                <option key={num} value={num}>{num} years</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-medium">Infants</p>
                                <p className="text-sm text-text-muted">Under 5 years</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => modifyGuest("infants", false)}
                                    disabled={isAtMin("infants")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    -
                                </button>
                                <span>{guests.infants}</span>
                                <button
                                    onClick={() => modifyGuest("infants", true)}
                                    disabled={isAtMax("infants")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {guests.infants > 0 && (
                            <p className="text-xs text-text-muted mt-1">
                                Maximum 2 infants allowed (0-4 years)
                            </p>
                        )}
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-medium">Pets</p>
                                <p className="text-sm text-text-muted"></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => modifyGuest("pets", false)}
                                    disabled={isAtMin("pets")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    -
                                </button>
                                <span>{guests.pets}</span>
                                <button
                                    onClick={() => modifyGuest("pets", true)}
                                    disabled={isAtMax("pets")}
                                    className="w-10 h-10 rounded-full border border-border-subtle flex items-center justify-center text-text-primary hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {hasSelection && hasInteractedWithDates && (
                <div id="pricing-breakdown" className="mt-6 space-y-3 border border-border-subtle rounded-xl p-4 bg-bg-surface shadow-level1">
                    <div className="space-y-2">
                        {nightlyBreakdown.map((night) => (
                            <div className="flex justify-between text-sm" key={night.date.toISOString()}>
                                <span className="flex items-center gap-2">
                                    {format(night.date, "dd MMM")} 
                                    {night.breakdown.isNewYearsEve && (
                                        <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-0.5 text-[11px] font-semibold text-cta-primary">
                                            New Year’s Eve pricing (2×)
                                        </span>
                                    )}
                                </span>
                                <span>₹{night.breakdown.finalNightlyPrice.toLocaleString("en-IN")}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between text-sm text-text-muted">
                        <span>Base price</span>
                        <span>₹{baseNightlyRate.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm text-cta-primary">
                        <span>Discount ({discountPercentApplied}%) applied</span>
                        <span>Included</span>
                    </div>
                    {extraGuestsCount > 0 && (
                        <div className="flex justify-between text-sm text-text-primary">
                            <span>Extra guests ({extraGuestsCount})</span>
                            <span>₹{totalExtraGuestCharges.toLocaleString("en-IN")}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-text-primary">
                        <span>Fees &amp; taxes (est.)</span>
                        <span>₹{feesAndTaxes.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-text-primary border-t pt-3">
                        <span>Total</span>
                        <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-text-muted">No hidden charges — everything is shown upfront for your dates and guest count.</p>
                </div>
            )}

            <div className="mt-4 space-y-3 text-sm text-text-primary border border-border-subtle rounded-xl p-4 bg-bg-muted">
                <div>
                    <p className="font-semibold text-text-primary">Guest details</p>
                    <p>{inlinePolicySnippets.guestId} <a className="underline" href="/terms#guests">Read more</a></p>
                </div>
                <div>
                    <p className="font-semibold text-text-primary">Cancellations</p>
                    <p>{inlinePolicySnippets.cancellation} <a className="underline" href="/terms#cancellations">Policy</a></p>
                </div>
                <div>
                    <p className="font-semibold text-text-primary">House rules &amp; damages</p>
                    <p>{inlinePolicySnippets.houseRules}</p>
                    <p className="mt-1">{inlinePolicySnippets.damages} <a className="underline" href="/terms#damages">Damages</a></p>
                </div>
            </div>

            <div className="space-y-4 mt-6">
              {/* Payment Method Selection */}
              <div className="p-4 border border-border-subtle rounded-xl bg-bg-surface shadow-level1">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-method"
                    className="h-5 w-5 text-cta-primary focus:ring-cta-primary"
                    defaultChecked
                    disabled={isLoading}
                  />
                  <div className="flex items-center">
                    <img
                      src="https://cdn.razorpay.com/logo.svg"
                      alt="Razorpay"
                      className="h-6 mr-2"
                    />
                    <span className="text-text-primary">Pay with Razorpay</span>
                  </div>
                </label>
                <p className="text-sm text-text-muted mt-2">{inlinePolicySnippets.paymentConsent}</p>
                <p className="text-xs text-text-muted mt-1">{isRazorpayReady ? 'Inline Razorpay checkout is ready.' : 'Preloading secure Razorpay checkout...'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--support-success) 12%, var(--bg-surface))',
                      color: 'var(--support-success)',
                    }}
                  >
                    <SiRazorpay className="text-success" /> Razorpay secured
                  </span>
                  <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
                    <FaCreditCard /> Cards
                  </span>
                  <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
                    <SiGooglepay /> UPI
                  </span>
                  <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
                    <FaCcVisa />
                    <FaCcMastercard />
                  </span>
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={termsAccepted}
                  onChange={(event) => {
                    setTermsAccepted(event.target.checked);
                    setTermsAcceptedAt(event.target.checked ? new Date().toISOString() : null);
                  }}
                />
                <span>
                  I agree to the <a className="underline" href="/terms">Terms &amp; Conditions</a> and the policies above.
                  {termsAcceptedAt && <span className="block text-text-muted">Accepted at {new Date(termsAcceptedAt).toLocaleString()}</span>}
                </span>
              </label>
              
              {/* Reserve Button */}
              <button
                onClick={initiatePayment}
                disabled={isLoading || !termsAccepted}
                className="bg-cta-primary hover:bg-cta-secondary text-[var(--text-contrast)] w-full rounded-full py-4 text-lg font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-level1"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-contrast)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  primaryCtaLabel
                )}
              </button>

              {paymentStatus.state === 'success' && (
                <div
                  className="rounded-xl p-4 space-y-2 border"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--support-success) 35%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--support-success) 12%, var(--bg-surface))',
                  }}
                >
                  <p className="text-success font-semibold">Payment received!</p>
                  <p className="text-sm text-text-primary">Booking ID: <span className="font-mono font-semibold">{paymentStatus.bookingId}</span></p>
                  <p className="text-sm text-text-primary">Payment reference: <span className="font-mono">{paymentStatus.paymentId}</span></p>
                  <p className="text-sm text-text-muted">We’ll confirm your stay shortly. In the meantime, you can save this booking ID and reach out for any changes.</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <a className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary" href="tel:+919833899938">Call concierge</a>
                    <a className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary" href="mailto:stay@atlashomestays.com?subject=Booking%20Support&body=Booking%20ID%3A%20">Email support</a>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-full bg-cta-secondary text-[var(--text-contrast)]"
                      onClick={() => setPaymentStatus({ state: 'idle' })}
                    >
                      Hide message
                    </button>
                  </div>
                </div>
              )}

              {paymentStatus.state === 'failure' && (
                <div
                  className="rounded-xl p-4 space-y-2 border"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--support-danger) 35%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--support-danger) 12%, var(--bg-surface))',
                  }}
                >
                  <p className="text-danger font-semibold">Payment was not completed</p>
                  <p className="text-sm text-text-primary">{paymentStatus.reason}</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={initiatePayment}
                      className="px-3 py-2 rounded-full bg-cta-secondary text-[var(--text-contrast)]"
                      disabled={isLoading}
                    >
                      Try again
                    </button>
                    <a className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary" href="tel:+919833899938">Call to pay</a>
                    <a className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary" href="mailto:stay@atlashomestays.com?subject=Payment%20Assistance&body=Please%20help%20me%20complete%20my%20booking.">Get help via email</a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between mt-5 border-t pt-4">
                <div>
                    <p className="text-lg font-semibold">Total Amount</p>
                    <p className="text-sm text-text-muted">Inclusive of estimated taxes and fees</p>
                </div>
                <p className="text-lg font-bold">
                    ₹{totalPrice.toLocaleString('en-IN')}
                </p>
            </div>

            <div
                className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border-subtle shadow-level2 px-4 py-3 flex items-center justify-between gap-3 z-[var(--z-sticky)]"
                style={{ paddingBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 0.75rem)' }}
            >
                <div className="flex flex-col text-xs text-text-muted">
                    <div className="font-semibold text-text-primary text-sm">{format(dates.startDate, 'dd MMM')} - {format(dates.endDate, 'dd MMM')}</div>
                    <div className="flex items-center gap-1 text-text-primary text-sm">
                        <FaUserFriends className="h-4 w-4" />
                        <span>{formatGuestLabel()}</span>
                    </div>
                    <p className="text-[11px] text-text-muted">No hidden charges</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="text-lg font-semibold">₹{totalPrice.toLocaleString('en-IN')}</p>
                    <button
                        onClick={initiatePayment}
                        disabled={isLoading || !termsAccepted}
                        className="mt-1 bg-cta-primary hover:bg-cta-secondary text-[var(--text-contrast)] rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-level1"
                    >
                        {primaryCtaLabel}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default BookingCard;
