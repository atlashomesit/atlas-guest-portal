import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useBooking } from '../contexts/BookingContext';
import { Button } from '../components/ui/Button';
import Subheading from '../components/commonComponents/subheading/Subheading';
import SEO from '../components/SEO';
import { getTenantBrandName } from '../tenant/displayBrand';
import { formatHumanDate } from '../utils/formatting';

const Reserve = () => {
  const { booking } = useBooking();
  const navigate = useNavigate();
  const brandName = getTenantBrandName();

  const hasSelection = Boolean(booking.listingDetailPath?.trim() && booking.checkIn && booking.checkOut);

  // TASK-4019: Guard against empty context — redirect to search with toast if no booking details
  useEffect(() => {
    if (!hasSelection) {
      toast.warn(`Open a property from ${brandName} listings first, then return here to pay.`);
      navigate('/search', { replace: true });
    }
  }, [hasSelection, navigate, brandName]);

  // Build a URL back to the property detail page with dates pre-filled so the
  // UnitBookingWidget can complete the Razorpay checkout without leaving the page.
  const goToPayment = () => {
    const base = booking.listingDetailPath?.trim();
    if (!base) {
      toast.error(`Open a property from search or ${brandName} listings first, then return here to pay.`);
      return;
    }

    const checkInParam = booking.checkIn ? `?checkIn=${encodeURIComponent(booking.checkIn)}` : '';
    const checkOutSep = booking.checkIn && booking.checkOut ? '&' : '?';
    const checkOutParam = booking.checkOut ? `${checkOutSep}checkOut=${encodeURIComponent(booking.checkOut)}` : '';
    const guestsParam = booking.guests ? `&guests=${booking.guests}` : '';

    navigate(`${base}${checkInParam}${checkOutParam}${guestsParam}`);
  };

  return (
    <>
    <SEO title={`Reserve | ${brandName}`} description={`Review your stay details and continue to secure payment with ${brandName}.`} />
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
            <p className="text-base text-text-muted">Property</p>
            <p className="text-lg font-semibold text-text-primary">
              {booking.propertyName ?? 'Not selected'}
            </p>
          </div>
          <div>
            <p className="text-base text-text-muted">Guests</p>
            <p className="text-lg font-semibold text-text-primary">{booking.guests}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Check-in</p>
            <p className="text-lg font-semibold text-text-primary">{formatHumanDate(booking.checkIn)}</p>
          </div>
          <div>
            <p className="text-base text-text-muted">Check-out</p>
            <p className="text-lg font-semibold text-text-primary">{formatHumanDate(booking.checkOut)}</p>
          </div>
        </div>

        {!hasSelection && (
          <div className="rounded-xl border border-support-error bg-[color:color-mix(in_srgb,var(--support-error)_10%,transparent)] text-support-error p-4 text-sm">
            We could not find complete booking details (including which property to pay for). Open a listing, pick dates, then use Reserve again — or go back to the property page.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigate(-1)}
            variant="secondary"
          >
            Back to previous page
          </Button>
          <Button
            onClick={goToPayment}
            disabled={!hasSelection}
          >
            Continue to booking
          </Button>
        </div>
      </div>
    </section>
    </>
  );
};

export default Reserve;
