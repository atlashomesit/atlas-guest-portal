// BookingCard.tsx — date-search widget used on location listing pages.
// Replaces the earlier stub (which threw in PROD and showed fake booking IDs).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildHomeUnitPath } from '../../../utils/navigation';
import { toEditableInt, clampMin } from '../../../utils/numericInput';

interface BookingCardProps {
  propertyId?: number;
  supportPadding?: boolean;
}

const getISTDateString = (date: Date): string => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
};

const today = () => getISTDateString(new Date());
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return getISTDateString(d);
};

const BookingCard: React.FC<BookingCardProps> = ({ propertyId, supportPadding = false }) => {
  const navigate = useNavigate();
  const [checkin, setCheckin] = useState(today());
  const [checkout, setCheckout] = useState(tomorrow());
  // Holds '' while the user is mid-edit so the field can be cleared on a mobile keyboard;
  // clamped on blur and again below, so the search URL always carries a real count.
  const [guests, setGuests] = useState<number | ''>(1);

  const handleSearch = () => {
    const params = new URLSearchParams({
      checkin,
      checkout,
      guests: String(clampMin(guests, 1)),
    });
    if (propertyId) {
      // TASK-5193/5203: always use two-segment canonical path (never /homes/:id alone).
      navigate(`${buildHomeUnitPath('listing', propertyId)}?${params.toString()}`);
    } else {
      navigate(`/?${params.toString()}#our-homes`);
    }
  };

  return (
    <div
      id="booking-form"
      data-property-id={propertyId}
      className={`mx-auto w-full max-w-3xl p-5 bg-white shadow-lg rounded-2xl ${supportPadding ? 'my-8' : ''}`}
    >
      <h2 className="text-xl font-bold text-gray-800 mb-4">Find your stay</h2>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
          <input
            type="date"
            value={checkin}
            min={today()}
            onChange={(e) => setCheckin(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
          <input
            type="date"
            value={checkout}
            min={checkin || today()}
            onChange={(e) => setCheckout(e.target.value)}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-gray-600 mb-1">Guests</label>
          <input
            type="number"
            value={guests}
            min={1}
            max={10}
            inputMode="numeric"
            onChange={(e) => setGuests(toEditableInt(e.target.value))}
            onBlur={() => setGuests((prev) => clampMin(prev, 1))}
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Search
        </button>
      </div>
    </div>
  );
};

export default BookingCard;
