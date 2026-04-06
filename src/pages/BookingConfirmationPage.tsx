import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";

interface BookingSummary {
  bookingId: number;
  guestName: string;
  propertyName: string;
  listingName: string;
  checkinDate: string;
  checkoutDate: string;
  nights: number;
  status: string;
  propertyAddress: string;
  propertyPhone: string;
  checkinInstructions: string;
  currency: string;
  totalAmount: number;
  wifiVisible: boolean;
  wifiName?: string;
  wifiPassword?: string;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  Confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
  CheckedIn: { label: "Checked In", color: "text-blue-700 bg-blue-50 border-blue-200" },
  CheckedOut: { label: "Checked Out", color: "text-gray-700 bg-gray-50 border-gray-200" },
  Cancelled: { label: "Cancelled", color: "text-red-700 bg-red-50 border-red-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusLabel[status] ?? { label: status, color: "text-gray-700 bg-gray-50 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border-subtle last:border-0">
      <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-sm text-text-primary ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !token) {
      setError("Invalid booking link. Please use the link from your confirmation email.");
      setLoading(false);
      return;
    }

    const url = buildApiUrl(`/api/guest/bookings/${bookingId}/summary?t=${encodeURIComponent(token)}`);
    fetch(url, {
      headers: { Accept: "application/json", ...getApiHeaders() },
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error("Booking not found. Please check your confirmation email for the correct link.");
        if (!res.ok) throw new Error("Unable to load booking details. Please try again.");
        return res.json() as Promise<BookingSummary>;
      })
      .then(setBooking)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-border-subtle border-t-brand-primary rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Loading your booking&hellip;</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h1 className="text-xl font-bold text-text-primary">Booking not found</h1>
          <p className="text-sm text-text-secondary">{error ?? "We could not find your booking. Please use the link from your confirmation email."}</p>
          <Link to="/" className="inline-block mt-2 text-sm text-brand-primary underline underline-offset-2">Return to homepage</Link>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "Cancelled";

  return (
    <>
      <SEO
        title={`Booking #${booking.bookingId} — ${booking.propertyName}`}
        description={`Your stay at ${booking.propertyName}: ${booking.checkinDate} to ${booking.checkoutDate}.`}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">Your Booking</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-text-secondary">
            Ref&nbsp;<span className="font-mono font-semibold text-text-primary">#{booking.bookingId}</span>
            &nbsp;&middot;&nbsp;{booking.listingName !== booking.propertyName ? booking.listingName : booking.propertyName}
          </p>
        </div>

        {isCancelled && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            This booking has been cancelled. If you have questions, please contact us at the number below.
          </div>
        )}

        {/* Stay dates */}
        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5 space-y-0 divide-y divide-border-subtle">
          <div className="pb-4 flex items-start gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <p className="font-semibold text-text-primary">{booking.propertyName}</p>
              {booking.propertyAddress && (
                <p className="text-sm text-text-secondary mt-0.5">{booking.propertyAddress}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Check-in</p>
              <p className="text-base font-semibold text-text-primary mt-0.5">{booking.checkinDate}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Check-out</p>
              <p className="text-base font-semibold text-text-primary mt-0.5">{booking.checkoutDate}</p>
            </div>
          </div>
          <div className="pt-4 flex justify-between items-center">
            <span className="text-sm text-text-secondary">
              {booking.nights} {booking.nights === 1 ? "night" : "nights"}
            </span>
            <span className="text-base font-bold text-text-primary">
              {booking.currency}&nbsp;{booking.totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Check-in info */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-0">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Check-in details</h2>
            <div className="space-y-0">
              {booking.checkinInstructions && (
                <InfoRow label="Check-in instructions" value={booking.checkinInstructions} />
              )}
              {booking.propertyPhone && (
                <InfoRow label="Property contact" value={booking.propertyPhone} />
              )}
              {!booking.checkinInstructions && !booking.propertyPhone && (
                <p className="text-sm text-text-secondary">Check-in instructions will be sent to you 24 hours before arrival.</p>
              )}
            </div>
          </div>
        )}

        {/* WiFi */}
        {!isCancelled && booking.wifiVisible && (booking.wifiName || booking.wifiPassword) && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">📶 WiFi</h2>
            <div className="space-y-0">
              {booking.wifiName && <InfoRow label="Network" value={booking.wifiName} />}
              {booking.wifiPassword && <InfoRow label="Password" value={booking.wifiPassword} mono />}
            </div>
          </div>
        )}

        {!isCancelled && !booking.wifiVisible && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-1">📶 WiFi</h2>
            <p className="text-sm text-text-secondary">WiFi details will be available here 48 hours before check-in.</p>
          </div>
        )}

        {/* Need help */}
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Need help?</h2>
          <p className="text-sm text-text-secondary">
            Call or WhatsApp us at{" "}
            <a href="tel:+917032493290" className="text-brand-primary font-medium">+91&nbsp;70324&nbsp;93290</a>
            {" "}or email{" "}
            <a href="mailto:atlashomeskphb@gmail.com" className="text-brand-primary font-medium">atlashomeskphb@gmail.com</a>.
          </p>
        </div>

        <div className="text-center pt-2">
          <Link to="/" className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary">
            ← Back to Atlas Homestays
          </Link>
        </div>
      </div>
    </>
  );
}
