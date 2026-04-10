import { useNavigate } from 'react-router-dom';
import { useBooking } from '../contexts/BookingContext';
import { Button } from '../components/ui/Button';
import Subheading from '../components/commonComponents/subheading/Subheading';
import { formatHumanDate } from '../utils/formatting';

const Reserve = () => {
  const { booking } = useBooking();
  const navigate = useNavigate();

  const hasSelection = Boolean(booking.propertyId && booking.checkIn && booking.checkOut);

  // Build a URL back to the property detail page with dates pre-filled so the
  // UnitBookingWidget can complete the Razorpay checkout without leaving the page.
  const goToPayment = () => {
    if (!booking.propertyId) return;

    // Determine the property slug. If we have it, navigate to the full detail page.
    // Fall back to home-details page by propertyId if slug is not stored.
    const checkInParam = booking.checkIn ? `?checkIn=${encodeURIComponent(booking.checkIn)}` : '';
    const checkOutSep = booking.checkIn && booking.checkOut ? '&' : '?';
    const checkOutParam = booking.checkOut ? `${checkOutSep}checkOut=${encodeURIComponent(booking.checkOut)}` : '';
    const guestsParam = booking.guests ? `&guests=${booking.guests}` : '';

    navigate(`/homes/${booking.propertyId}${checkInParam}${checkOutParam}${guestsParam}`);
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      <div className="pt-6">
        <Subheading />
      </div>

      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.12em] text-text-muted font-semibold">Reserve</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Finalize your stay</h1>
        <p className="text-text-secondary">We prefilled your booking details from the property page. Review them below before confirming.</p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-text-muted">Property</p>
            <p className="text-lg font-semibold text-text-primary">
              {booking.propertyName ?? 'Not selected'}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Guests</p>
            <p className="text-lg font-semibold text-text-primary">{booking.guests}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Check-in</p>
            <p className="text-lg font-semibold text-text-primary">{formatHumanDate(booking.checkIn)}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Check-out</p>
            <p className="text-lg font-semibold text-text-primary">{formatHumanDate(booking.checkOut)}</p>
          </div>
        </div>

        {!hasSelection && (
          <div className="rounded-xl border border-support-error bg-[color:color-mix(in_srgb,var(--support-error)_10%,transparent)] text-support-error p-4 text-sm">
            We could not find complete booking details. Please return to the property page and try again.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="secondary"
          >
            Back to previous page
          </Button>
          {/* Option A: navigate back to property page with dates pre-filled so
              UnitBookingWidget handles the full Razorpay payment flow inline. */}
          <Button
            onClick={goToPayment}
            disabled={!hasSelection}
          >
            Go to payment
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          You will be taken to the property page to complete your secure payment via Razorpay.
        </p>
      </div>
    </section>
  );
};

export default Reserve;
