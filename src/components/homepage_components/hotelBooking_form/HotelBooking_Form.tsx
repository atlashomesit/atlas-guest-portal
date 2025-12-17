import { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import { propertyData } from '../../../data';
import { inlinePolicySnippets } from '../../../content/terms';
import { baseGuestAllowance, getUnitPolicy } from '../../../config/policyConfig';

declare global {
  interface Window {
    Razorpay: any;
  }
}

import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface BookingCardProps {
    propertyId: number;
}

const BookingCard: React.FC<BookingCardProps> = ({ propertyId }) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openGuests, setOpenGuests] = useState(false);

    const [dates, setDates] = useState({
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000), // Next day by default
        key: "selection",
    });
    
    const handleDateChange = (ranges: any) => {
        const { startDate, endDate } = ranges.selection;
        
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
    const basePrice = property?.property_price || 0;
    
    // Calculate total number of people (adults + children)
    const totalPeople = guests.adults + guests.children;
    
    const additionalPeople = Math.max(0, totalPeople - baseGuestAllowance);
    const extraGuestRate = Number(propertyId) === 501 ? 700 : 400;
    const extraGuestChargePerNight = additionalPeople * extraGuestRate;
    const nightlyRateWithGuests = basePrice + extraGuestChargePerNight;
    
    // Calculate number of nights (minimum 1 night)
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const nights = Math.max(1, Math.round(Math.abs((dates.endDate.getTime() - dates.startDate.getTime()) / oneDay)));
    
    // Calculate total price based on number of nights
    const staySubtotal = nightlyRateWithGuests * nights;
    const feesAndTaxes = Math.round(staySubtotal * 0.12);
    const totalPrice = staySubtotal + feesAndTaxes;
    
    // Log for debugging
    console.log('Property ID:', propertyId, 'Adults:', guests.adults, 'Children:', guests.children, 'Total people:', totalPeople, 'Nightly rate with guests:', nightlyRateWithGuests);

    const guestMenuRef = useRef<HTMLDivElement | null>(null);
    const calendarRef = useRef<HTMLDivElement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);

    // Removed loadRazorpay function as it's no longer needed with direct link redirection

    const initiatePayment = () => {
  if (!termsAccepted) {
    alert('Please confirm the Terms & Conditions before reserving.');
    return;
  }
  try {
    setIsLoading(true);
    const acceptedAt = termsAcceptedAt || new Date().toISOString();
    setTermsAcceptedAt(acceptedAt);
    // TODO: Persist termsAccepted + acceptedAt to booking payload or analytics when backend wiring is added.
    try {
      localStorage.setItem('atlas_terms_accepted_at', acceptedAt);
    } catch (error) {
      console.warn('Unable to persist terms acceptance locally', error);
    }

    const url = new URL('https://pages.razorpay.com/atlashomestays');
    url.searchParams.append('amount', totalPrice.toString());
    url.searchParams.append('currency', 'INR');

    window.location.href = url.toString();

  } catch (error) {
    console.error('Payment error:', error);
    alert('Error processing payment. Please try again.');
    setIsLoading(false);
  }
};

    const unitPolicy = getUnitPolicy(propertyId);


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

    const modifyGuest = (type: keyof typeof guests, increment: boolean) => {
        setGuests(prev => ({
            ...prev,
            [type]: Math.max(0, prev[type] + (increment ? 1 : -1)),
        }));
    };

    const hasSelection = Boolean(dates.startDate && dates.endDate && guests.adults);

    return (
        <div id="booking-form" className="max-w-md mx-auto p-6 bg-white shadow-xl rounded-2xl relative pb-24 lg:pb-0">

            {/* PRICE SECTION */}
            <p className="text-[30px] font-bold">
                ₹{nightlyRateWithGuests.toLocaleString()}

                <span className="text-base ml-1">/night</span>
            </p>

            {property && (
                <div className="mb-4 space-y-1">
                    <p className="text-amber-600 text-sm font-semibold">★ {property.property_rating.toFixed(2)} ({property.property_reviews} reviews)</p>
                    {property.property_review_snippets?.[0] && (
                        <p className="text-sm text-gray-700 italic">“{property.property_review_snippets[0]}”</p>
                    )}
                </div>
            )}

            <div className="mb-4 space-y-1 text-sm text-gray-700">
                <p>
                    Base price includes {baseGuestAllowance} guests; additional guests incur {unitPolicy.extraGuestFeeRange} per night (unit dependent).
                    <a className="underline ml-1" href="/terms#guests">See terms</a>
                </p>
                <p>
                    Check-in {unitPolicy.checkIn} · Check-out {unitPolicy.checkOut}.<a className="underline ml-1" href="/terms#check-in-check-out">Timings</a>
                </p>
            </div>


            <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                    onClick={() => setOpenCalendar(true)}
                    className="border rounded-xl p-3 cursor-pointer"
                >
                    <p className="text-sm text-gray-500">Check-In Date</p>
                    <p className="font-semibold">
                        {format(dates.startDate, "dd-MM-yyyy")}
                    </p>
                </div>

                <div
                    onClick={() => setOpenCalendar(true)}
                    className="border rounded-xl p-3 cursor-pointer"
                    title={dates.startDate.getTime() === dates.endDate.getTime() ? "Check-out date must be after check-in date" : ""}
                >
                    <p className="text-sm text-gray-500">Check-Out Date</p>
                    <p className="font-semibold">
                        {format(dates.endDate, "dd-MM-yyyy")}
                    </p>
                </div>
            </div>

            {openCalendar && (
                <div ref={calendarRef} className="absolute right-0 z-50 bg-white shadow-lg rounded-xl mt-2 overflow-hidden border border-gray-200">
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
                        rangeColors={['#B99359']}
                        showDateDisplay={false}
                        showPreview={false}
                        showSelectionPreview={true}
                        months={1}
                        direction="horizontal"
                        className="text-sm"
                        monthDisplayFormat="MMMM yyyy"
                        weekdayDisplayFormat="EEEE"
                        dayDisplayFormat="d"
                    />
                </div>
            )}

            {/* GUEST SELECTOR */}
            <div
                onClick={() => setOpenGuests(true)}
                className="border rounded-xl p-3 cursor-pointer flex justify-between items-center"
            >
                <div>
                    <p className="text-sm text-gray-500">Guests</p>
                    <p className="font-semibold">{formatGuestLabel()}</p>
                </div>
            </div>

            {/* UPDATED POPUP SECTION */}
            {openGuests && (
                <div
                    ref={guestMenuRef}
                    className="absolute left-1/2 -translate-x-1/2 bg-white z-50 rounded-xl shadow-xl border p-4 overflow-y-auto"
                    style={{
                        width: "90%",          // Increased Width
                        maxHeight: "200px",    // Reduced Height
                        top: "260px",
                    }}
                >
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-medium">Adults</p>
                                <p className="text-sm text-gray-500">Age 14 or above</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => modifyGuest("adults", false)}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    -
                                </button>
                                <span>{guests.adults}</span>
                                <button
                                    onClick={() => modifyGuest("adults", true)}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
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
                                <p className="text-sm text-gray-500">Ages 5-12</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        if (guests.children > 0) {
                                            setGuests(prev => ({
                                                ...prev,
                                                children: prev.children - 1,
                                                childrenAges: prev.childrenAges.slice(0, -1)
                                            }));
                                        }
                                    }}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    -
                                </button>
                                <span>{guests.children}</span>
                                <button
                                    onClick={() => {
                                        setGuests(prev => ({
                                            ...prev,
                                            children: prev.children + 1,
                                            childrenAges: [...prev.childrenAges, 5] // Default age 5
                                        }));
                                    }}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
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
                                <p className="text-sm text-gray-500">Under 5 years</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        if (guests.infants > 0) {
                                            setGuests(prev => ({
                                                ...prev,
                                                infants: prev.infants - 1
                                            }));
                                        }
                                    }}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    -
                                </button>
                                <span>{guests.infants}</span>
                                <button
                                    onClick={() => {
                                        if (guests.infants < 2) { // Limit to 2 infants
                                            setGuests(prev => ({
                                                ...prev,
                                                infants: prev.infants + 1
                                            }));
                                        }
                                    }}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        {guests.infants > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                Maximum 2 infants allowed (0-4 years)
                            </p>
                        )}
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <p className="font-medium">Pets</p>
                                <p className="text-sm text-gray-500"></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => modifyGuest("pets", false)}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    -
                                </button>
                                <span>{guests.pets}</span>
                                <button
                                    onClick={() => modifyGuest("pets", true)}
                                    className="w-8 h-8 rounded-full border flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {hasSelection && (
                <div className="mt-6 space-y-3 border rounded-xl p-4 bg-white shadow-sm">
                    <div className="flex justify-between text-sm">
                        <span>{nights} night{nights > 1 ? 's' : ''} × ₹{(nightlyRateWithGuests - extraGuestChargePerNight).toLocaleString('en-IN')}</span>
                        <span>₹{((nightlyRateWithGuests - extraGuestChargePerNight) * nights).toLocaleString('en-IN')}</span>
                    </div>
                    {additionalPeople > 0 && (
                        <div className="flex justify-between text-sm text-gray-700">
                            <span>Extra guests ({additionalPeople} × ₹{extraGuestRate})</span>
                            <span>₹{(extraGuestChargePerNight * nights).toLocaleString('en-IN')}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-700">
                        <span>Fees &amp; taxes (est.)</span>
                        <span>₹{feesAndTaxes.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-gray-900 border-t pt-3">
                        <span>Total</span>
                        <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-xs text-gray-500">No hidden charges — everything is shown upfront for your dates and guest count.</p>
                </div>
            )}

            <div className="mt-4 space-y-3 text-sm text-gray-700 border rounded-xl p-4 bg-gray-50">
                <div>
                    <p className="font-semibold text-gray-900">Guest details</p>
                    <p>{inlinePolicySnippets.guestId} <a className="underline" href="/terms#guests">Read more</a></p>
                </div>
                <div>
                    <p className="font-semibold text-gray-900">Cancellations</p>
                    <p>{inlinePolicySnippets.cancellation} <a className="underline" href="/terms#cancellations">Policy</a></p>
                </div>
                <div>
                    <p className="font-semibold text-gray-900">House rules &amp; damages</p>
                    <p>{inlinePolicySnippets.houseRules}</p>
                    <p className="mt-1">{inlinePolicySnippets.damages} <a className="underline" href="/terms#damages">Damages</a></p>
                </div>
            </div>

            <div className="space-y-4 mt-6">
              {/* Payment Method Selection */}
              <div className="p-4 border rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-method"
                    className="h-5 w-5 text-[#B99359] focus:ring-[#B99359]"
                    defaultChecked
                    disabled={isLoading}
                  />
                  <div className="flex items-center">
                    <img
                      src="https://cdn.razorpay.com/logo.svg"
                      alt="Razorpay"
                      className="h-6 mr-2"
                    />
                    <span className="text-gray-700">Pay with Razorpay</span>
                  </div>
                </label>
                <p className="text-sm text-gray-600 mt-2">{inlinePolicySnippets.paymentConsent}</p>
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-700">
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
                  {termsAcceptedAt && <span className="block text-gray-500">Accepted at {new Date(termsAcceptedAt).toLocaleString()}</span>}
                </span>
              </label>
              
              {/* Reserve Button */}
              <button
                onClick={initiatePayment}
                disabled={isLoading || !termsAccepted}
                className="bg-[#B99359] hover:bg-[#A0804D] text-white w-full rounded-full py-4 text-lg font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Reserve Now'
                )}
              </button>
            </div>

            <div className="flex justify-between mt-5 border-t pt-4">
                <div>
                    <p className="text-lg font-semibold">Total Amount</p>
                    <p className="text-sm text-gray-500">Inclusive of estimated taxes and fees</p>
                </div>
                <p className="text-lg font-bold">
                    ₹{totalPrice.toLocaleString('en-IN')}
                </p>
            </div>

            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl px-4 py-3 flex items-center justify-between z-40">
                <div>
                    <p className="text-xs text-gray-600">Total for your stay</p>
                    <p className="text-lg font-semibold">₹{totalPrice.toLocaleString('en-IN')}</p>
                    <p className="text-[11px] text-gray-500">No hidden charges</p>
                </div>
                <button
                    onClick={initiatePayment}
                    disabled={isLoading || !termsAccepted}
                    className="bg-[#B99359] hover:bg-[#A0804D] text-white rounded-full px-4 py-3 text-sm font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    Reserve Now
                </button>
            </div>

        </div>
    );
};

export default BookingCard;
