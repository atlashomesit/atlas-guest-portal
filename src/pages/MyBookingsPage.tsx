import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import StateMessage from "../components/StateMessage";
import { LoadingState } from "../components/LoadingState";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";
import { getContactEmail, getTelLink, hasHostContact } from "../config/contact";
import { getTenantBrandName } from "../tenant/displayBrand";
import { useGuestAuth } from "../contexts/GuestAuthContext";

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

type BookingsTab = "upcoming" | "past" | "cancelled";

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseBookingDate(s: string): Date {
  const t = s.trim();
  const iso = /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : t;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export default function MyBookingsPage() {
  const brandName = getTenantBrandName();
  const [searchParams] = useSearchParams();
  const guestId = searchParams.get("guestId");
  const token = searchParams.get("t");
  const { auth, isLoading: authLoading } = useGuestAuth();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BookingsTab>("upcoming");

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const loadFromMagicLink = async () => {
      const url = buildApiUrl(
        `/api/guest/bookings?guestId=${encodeURIComponent(guestId!)}&t=${encodeURIComponent(token!)}`
      );
      const res = await fetch(url, { headers: { Accept: "application/json", ...getApiHeaders() } });
      if (res.status === 404) throw new Error("No bookings found. Please use the link from your booking confirmation.");
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      return res.json() as Promise<BookingItem[]>;
    };

    const loadFromJwt = async () => {
      const url = buildApiUrl("/api/guest/auth/bookings");
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth.token}`,
          ...getApiHeaders(),
        },
      });
      if (res.status === 401) throw new Error("Your session expired. Please log in again.");
      if (res.status === 404) throw new Error("No bookings found for your account.");
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      return res.json() as Promise<BookingItem[]>;
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const hasMagicLink = Boolean(guestId && token);
        const hasJwt = auth.isAuthenticated && auth.token;

        if (!hasMagicLink && !hasJwt) {
          setError("Sign in to view your trips, or use the link from your booking confirmation email.");
          setBookings([]);
          return;
        }

        const data = hasMagicLink ? await loadFromMagicLink() : await loadFromJwt();
        if (!cancelled) setBookings(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "We couldn't load your bookings — please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [guestId, token, auth.isAuthenticated, auth.token, authLoading]);

  const filteredBookings = useMemo(() => {
    const today = startOfTodayUtc();
    const isCancelled = (b: BookingItem) => b.status?.toLowerCase() === "cancelled";
    if (tab === "cancelled") return bookings.filter(isCancelled);
    return bookings.filter((b) => {
      if (isCancelled(b)) return false;
      // TASK-2568: classify by checkout date so in-progress stays (checked in, not yet out) show under "Upcoming"
      const cout = parseBookingDate(b.checkoutDate);
      if (tab === "upcoming") return cout >= today;
      /* past — checkout is in the past */
      return cout < today;
    });
  }, [bookings, tab]);

  if (loading || authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <LoadingState kind="skeleton-list" count={4} message="Loading bookings…" />
      </div>
    );
  }

  if (error) {
    return (
      <StateMessage
        data-testid="my-bookings-error-state"
        icon="📋"
        title="Bookings not found"
        message={error}
        primaryAction={{
          label: auth.isAuthenticated ? "Browse homes" : "Log in",
          ...(auth.isAuthenticated ? { to: "/" } : { to: "/login" }),
        }}
        secondaryActions={[
          {
            label: "Email support",
            href: `mailto:${getContactEmail()}?subject=${encodeURIComponent(`${brandName} booking history link`)}`,
          },
          { label: "Return to homepage", to: "/" },
        ]}
      />
    );
  }

  return (
    <>
      <SEO title="My Bookings" description={`View your booking history at ${brandName}.`} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">My Bookings</h1>
          <p className="text-sm text-text-secondary">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} found</p>
        </div>

        {bookings.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter bookings">
            {(["upcoming", "past", "cancelled"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold capitalize transition-colors border ${
                  tab === id
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-bg-surface text-text-primary border-border-subtle hover:bg-bg-muted"
                }`}
              >
                {id === "upcoming" ? "Upcoming" : id === "past" ? "Past" : "Cancelled"}
              </button>
            ))}
          </div>
        )}

        {bookings.length === 0 ? (
          <StateMessage
            data-testid="my-bookings-empty-state"
            icon="🧳"
            title="No bookings yet"
            message="Once you book a home it'll show up here. Bookings are linked to the email or phone used at checkout — if you used a different contact, open the link from that confirmation email or WhatsApp message."
            primaryAction={{ label: "Browse our homes", to: "/" }}
            secondaryActions={hasHostContact() ? [{ label: "Call us to find a booking", href: getTelLink() }] : []}
          />
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-muted/40 px-4 py-6 text-center text-sm text-text-secondary">
            No {tab === "upcoming" ? "upcoming" : tab === "past" ? "past" : "cancelled"} bookings in this view.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((b) => {
              const statusClass = STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700";
              const inStay = b.status === "CheckedIn";
              const checkoutFormatted = parseBookingDate(b.checkoutDate).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
              });
              const statusLabel = inStay
                ? `In progress · check out ${checkoutFormatted}`
                : b.status;
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
                    <span
                      className={`text-base font-medium px-2 py-1 rounded-full shrink-0 ${statusClass}`}
                      data-testid={inStay ? "my-bookings-in-stay-badge" : undefined}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    <span>{b.checkinDate} → {b.checkoutDate}</span>
                    <span className="font-mono text-base text-text-muted">#{b.bookingRef}</span>
                    <span className="ml-auto font-medium text-text-primary">₹{Number(b.totalAmount).toLocaleString("en-IN")}</span>
                  </div>
                  {inStay && (
                    <p className="mt-2 text-sm text-text-muted" data-testid="my-bookings-in-stay-hint">
                      View check-in details, address, and host contact on your confirmation page.
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {bookings.length > 0 && bookings[0].token && (
          <div className="text-center pt-2 flex flex-col items-center gap-2">
            {(guestId && token) && (
              <Link
                to={`/profile?bookingId=${bookings[0].id}&t=${encodeURIComponent(token)}`}
                className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
              >
                Update contact details
              </Link>
            )}
            <Link
              to={`/preferences/${encodeURIComponent(bookings[0].token)}`}
              className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
              data-testid="my-bookings-manage-preferences"
            >
              Manage email &amp; WhatsApp preferences
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
