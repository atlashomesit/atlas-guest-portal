import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";
import { getContactEmail } from "../config/contact";

interface BookingItem {
  id: number;
  bookingRef: string;
  propertyName: string;
  listingName: string;
  checkinDate: string;
  checkoutDate: string;
  status: string;
  totalAmount: number;
  token: string;
}

const STATUS_COLORS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-800",
  CheckedIn: "bg-blue-100 text-blue-800",
  CheckedOut: "bg-gray-100 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
  Lead: "bg-yellow-100 text-yellow-800",
};

export default function MyBookingsPage() {
  const [searchParams] = useSearchParams();
  const guestId = searchParams.get("guestId");
  const token = searchParams.get("t");

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId || !token) {
      setError("Booking history link is missing guest details. Please use the link from your booking confirmation.");
      setLoading(false);
      return;
    }
    const url = buildApiUrl(
      `/api/guest/bookings?guestId=${encodeURIComponent(guestId)}&t=${encodeURIComponent(token)}`
    );
    fetch(url, { headers: { Accept: "application/json", ...getApiHeaders() } })
      .then(async (res) => {
        if (res.status === 404) throw new Error("No bookings found. Please use the link from your booking confirmation.");
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        return res.json() as Promise<BookingItem[]>;
      })
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [guestId, token]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-border-subtle border-t-brand-primary rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">📋</div>
          <h1 className="text-xl font-bold text-text-primary">Bookings not found</h1>
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-base font-medium px-4 py-3 hover:opacity-95 transition-opacity"
            data-testid="my-bookings-retry"
          >
            Try again
          </button>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch">
            <a
              href={`mailto:${getContactEmail()}?subject=${encodeURIComponent("Atlas booking history link")}`}
              className="inline-flex items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-text-primary text-base font-medium px-4 py-3 hover:bg-bg-muted transition-colors"
            >
              Email support
            </a>
            <Link to="/" className="inline-flex items-center justify-center text-base text-brand-primary underline underline-offset-2 px-2 py-3">
              Return to homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Bookings" description="View your booking history at Atlas Homestays." />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">My Bookings</h1>
          <p className="text-sm text-text-secondary">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} found</p>
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-text-secondary text-sm">No bookings found.</p>
            <Link to="/" className="btn-chip inline-block">
              Browse our homes
            </Link>
            <p className="text-text-secondary text-xs max-w-md mx-auto">
              Bookings are linked to the email or phone used during checkout. If you booked with a different contact, open the confirmation link from that email or WhatsApp message instead.
            </p>
            <p className="text-text-secondary text-xs max-w-md mx-auto">
              Need help? Call us at{" "}
              <a href="tel:+917032493290" className="underline underline-offset-2 text-brand-primary">+91 7032 493 290</a>{" "}
              to locate a booking by reference number.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const statusClass = STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700";
              return (
                <Link
                  key={b.id}
                  to={`/booking/${b.id}?t=${encodeURIComponent(b.token)}`}
                  className="block rounded-xl border border-border-subtle bg-bg-surface px-4 py-4 hover:border-brand-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="text-base font-semibold text-text-primary">{b.listingName}</p>
                      <p className="text-sm text-text-muted">{b.propertyName}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    <span>{b.checkinDate} → {b.checkoutDate}</span>
                    <span className="font-mono text-text-muted">#{b.bookingRef}</span>
                    <span className="ml-auto font-medium text-text-primary">₹{Number(b.totalAmount).toLocaleString("en-IN")}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {guestId && token && (
          <div className="text-center pt-2">
            <Link
              to={`/profile?bookingId=${bookings[0]?.id ?? ""}&t=${encodeURIComponent(token)}`}
              className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
            >
              Update contact details
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
