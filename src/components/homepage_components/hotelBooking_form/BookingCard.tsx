// BookingCard.tsx — date-search widget used on location listing pages.
// Replaces the earlier stub (which threw in PROD and showed fake booking IDs).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface BookingCardProps {
  propertyId?: number;
  supportPadding?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const BookingCard: React.FC<BookingCardProps> = ({ propertyId, supportPadding = false }) => {
  const navigate = useNavigate();
  const [checkin, setCheckin] = useState(today());
  const [checkout, setCheckout] = useState(tomorrow());
  const [guests, setGuests] = useState(1);

  const handleSearch = () => {
    const params = new URLSearchParams({
      checkin,
      checkout,
      guests: String(guests),
    });
    if (propertyId) {
      navigate(`/homes/${propertyId}?${params.toString()}`);
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
            onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
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
