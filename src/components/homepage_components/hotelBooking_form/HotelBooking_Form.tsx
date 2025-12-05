import { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import { propertyData } from '../../../data';

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
    
    // Calculate price based on property ID
    let pricePerNight;
    if (Number(propertyId) === 501) {
        // For property 501: Base price for 2 people, ₹700 per additional person (adult or child)
        const additionalPeople = Math.max(0, totalPeople - 2);
        pricePerNight = basePrice + (additionalPeople * 700);
    } else {
        // For other properties: Base price for 2 people, ₹400 per additional person (adult or child)
        const additionalPeople = Math.max(0, totalPeople - 2);
        pricePerNight = basePrice + (additionalPeople * 400);
    }
    
    const originalPrice = Math.round(pricePerNight * 1.1); // 10% higher than the current price
    
    // Log for debugging
    console.log('Property ID:', propertyId, 'Adults:', guests.adults, 'Children:', guests.children, 'Total people:', totalPeople, 'Price per night:', pricePerNight);

    const guestMenuRef = useRef<HTMLDivElement | null>(null);
    const calendarRef = useRef<HTMLDivElement | null>(null);

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

    return (
        <div className="max-w-md mx-auto p-6 bg-white shadow-xl rounded-2xl relative">

            {/* PRICE SECTION */}
            <p className="text-[30px] font-bold">
                ₹{pricePerNight.toLocaleString()}
                
                <span className="text-base ml-1">/night</span>
            </p>

            <p className="text-yellow-500 text-sm mb-4">★ 4.78 (21 reviews)</p>


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
                <div ref={calendarRef} className="absolute left-0 z-50 bg-white shadow-lg rounded-xl mt-2">
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
                        rangeColors={['#FF5A5F']}
                        showDateDisplay={false}
                        showPreview={false}
                        showSelectionPreview={true}
                        months={2}
                        direction="horizontal"
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

            <button className="bg-[#e24627] text-white w-full rounded-full py-4 mt-6 text-lg font-semibold">
                Reserve
            </button>

            <div className="flex justify-between mt-5 border-t pt-4">
                <p className="text-lg font-semibold">Total Price : </p>
                <p className="text-lg font-bold">
                    ₹{pricePerNight.toLocaleString()}
                </p>
            </div>

        </div>
    );
};

export default BookingCard;
