import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { getRuntimeConfig, hasRuntimeConfig } from "../runtime-config";

interface BookingSummary {
  bookingId: number;
  guestId?: number;
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
  /** Present when a non-voided GST invoice exists for this booking. */
  hasGstInvoice?: boolean;
  gstInvoiceNumber?: string | null;
  gstInvoiceTotal?: number | null;
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
    <div className="flex flex-col gap-0.5 py-3 border-b border-border-subtle last:border-0">
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
  const [pushState, setPushState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pushMessage, setPushMessage] = useState<string>("");
  const [modCheckin, setModCheckin] = useState("");
  const [modCheckout, setModCheckout] = useState("");
  const [modGuests, setModGuests] = useState("");
  const [modNote, setModNote] = useState("");
  const [modSubmitting, setModSubmitting] = useState(false);
  const [modMessage, setModMessage] = useState<string>("");
  // TASK-350: guest self-service cancellation request
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string>("");
  const [cancelRequested, setCancelRequested] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

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

  const pdfUrl =
    bookingId && token
      ? buildApiUrl(`/api/guest/bookings/${bookingId}/invoice/pdf?t=${encodeURIComponent(token)}`)
      : "";

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
  const hostPhone = booking.propertyPhone?.trim() || "+917032493290";
  const hostPhoneDigits = hostPhone.replace(/[^\d+]/g, "");
  const whatsappDigits = hostPhoneDigits.replace(/^\+/, "");
  const whatsappText = encodeURIComponent(`Hi, I have a question about booking #${booking.bookingId}.`);
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${whatsappText}`;
  const supportsPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const canRequestModification = !isCancelled && !!token;

  // TASK-333: Generate and download ICS calendar event for check-in
  function downloadCalendar() {
    const formatIcsDate = (dateStr: string, timeStr: string) => {
      // dateStr is YYYY-MM-DD, timeStr is HH:MM (24h IST)
      const [y, m, d] = dateStr.split("-");
      const [h, min] = timeStr.split(":");
      // Store as floating time (no timezone conversion needed — IST local)
      return `${y}${m}${d}T${h}${min}00`;
    };
    const checkin = formatIcsDate(booking.checkinDate, "14:00");
    const checkout = formatIcsDate(booking.checkoutDate, "12:00");
    const uid = `atlas-booking-${booking.bookingId}@atlashomestays.com`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Atlas Homestays//BookingConfirmation//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${checkin}`,
      `DTEND:${checkout}`,
      `SUMMARY:Check-in at ${booking.propertyName}`,
      `DESCRIPTION:Booking #${booking.bookingId}. Host: ${hostPhone}. Check-out on ${booking.checkoutDate}.`,
      `LOCATION:${booking.propertyAddress || booking.propertyName}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-booking-${booking.bookingId}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toBase64UrlUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  async function subscribePush() {
    setPushState("loading");
    setPushMessage("");
    try {
      const vapidKey = hasRuntimeConfig() ? getRuntimeConfig().webPushPublicKey : undefined;
      if (!vapidKey) throw new Error("Notifications are not configured yet.");
      if (!supportsPush) throw new Error("Push notifications are not supported in this browser.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was denied.");

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBase64UrlUint8Array(vapidKey),
      });

      const res = await fetch(buildApiUrl("/api/public/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({ subscriptionJson: JSON.stringify(sub.toJSON()) }),
      });
      if (!res.ok) throw new Error("Unable to save notification preference.");
      setPushState("done");
      setPushMessage("Notifications enabled. We'll send important booking updates.");
    } catch (e) {
      setPushState("error");
      setPushMessage(e instanceof Error ? e.message : "Failed to enable notifications.");
    }
  }

  async function submitModificationRequest() {
    if (!bookingId || !token) return;
    setModMessage("");
    if (!modCheckin || !modCheckout) {
      setModMessage("Please enter both check-in and check-out dates.");
      return;
    }
    setModSubmitting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${bookingId}/modification-request?t=${encodeURIComponent(token)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({
            checkinDateUtc: modCheckin,
            checkoutDateUtc: modCheckout,
            guests: modGuests ? Number(modGuests) : undefined,
            note: modNote,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Could not submit request.");
      }
      setModMessage("Request submitted. Our team will review and contact you.");
      setModCheckin("");
      setModCheckout("");
      setModGuests("");
      setModNote("");
    } catch (e) {
      setModMessage(e instanceof Error ? e.message : "Could not submit request.");
    } finally {
      setModSubmitting(false);
    }
  }

  // TASK-350: submit guest cancellation request
  async function submitCancellationRequest() {
    if (!bookingId || !token) return;
    setCancelSubmitting(true);
    setCancelMessage("");
    try {
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${bookingId}/cancellation-request?t=${encodeURIComponent(token)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ reason: cancelReason }),
        },
      );
      if (res.status === 409) {
        setCancelMessage("This booking is already cancelled or checked out.");
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Could not submit request.");
      }
      setCancelRequested(true);
      setCancelMessage("Cancellation request submitted. Our team will review and contact you within 24 hours.");
      setShowCancelConfirm(false);
    } catch (e) {
      setCancelMessage(e instanceof Error ? e.message : "Could not submit request. Please contact us.");
    } finally {
      setCancelSubmitting(false);
    }
  }

  return (
    <>
      <SEO
        title={`Booking #${booking.bookingId} — ${booking.propertyName}`}
        description={`Your stay at ${booking.propertyName}: ${booking.checkinDate} to ${booking.checkoutDate}.`}
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6" data-testid="booking-confirmation-page">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">Your Booking</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-text-secondary">
            Ref&nbsp;<span className="font-mono font-semibold text-text-primary" data-testid="booking-reference">#{booking.bookingId}</span>
            &nbsp;&middot;&nbsp;{booking.listingName !== booking.propertyName ? booking.listingName : booking.propertyName}
          </p>
          {booking.guestName ? (
            <p className="text-sm text-text-secondary" data-testid="confirmation-guest-name">
              {booking.guestName}
            </p>
          ) : null}
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
              <p className="font-semibold text-text-primary" data-testid="confirmation-property-name">{booking.propertyName}</p>
              {booking.propertyAddress && (
                <p className="text-sm text-text-secondary mt-0.5">{booking.propertyAddress}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Check-in</p>
              <p className="text-base font-semibold text-text-primary mt-0.5" data-testid="confirmation-checkin">{booking.checkinDate}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Check-out</p>
              <p className="text-base font-semibold text-text-primary mt-0.5" data-testid="confirmation-checkout">{booking.checkoutDate}</p>
            </div>
          </div>
          <div className="pt-4 flex justify-between items-center">
            <span className="text-sm text-text-secondary">
              {booking.nights} {booking.nights === 1 ? "night" : "nights"}
            </span>
            <span className="text-base font-bold text-text-primary" data-testid="confirmation-total">
              {booking.currency}&nbsp;{booking.totalAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* GST invoice (token-gated PDF) */}
        {!isCancelled && booking.hasGstInvoice && pdfUrl && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">GST invoice</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Accommodation is billed under SAC&nbsp;9963 (hotel and similar accommodation services) as applicable for Indian GST.
            </p>
            <div className="space-y-0 divide-y divide-border-subtle border-t border-border-subtle -mx-5 px-5">
              {booking.gstInvoiceNumber && (
                <InfoRow label="Invoice number" value={booking.gstInvoiceNumber} mono />
              )}
              {booking.gstInvoiceTotal != null && (
                <div className="flex flex-col gap-0.5 py-3 border-b border-border-subtle last:border-0">
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Invoice total (incl. GST)</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {booking.currency}&nbsp;{booking.gstInvoiceTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="download-invoice-btn"
              className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3.5 hover:opacity-95 transition-opacity"
            >
              Download invoice (PDF)
            </a>
          </div>
        )}

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

        {/* What happens next */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">What happens next</h2>
            <div className="space-y-2.5 text-sm text-text-secondary">
              <p>✅ Booking confirmed now.</p>
              <p>📱 SMS and WhatsApp confirmation should arrive shortly.</p>
              <p data-testid="confirmation-t-minus-1">
                {/* TASK-546: Explicit T-1 WhatsApp reminder date */}
                {(() => {
                  try {
                    const checkinDate = new Date(booking.checkinDate);
                    if (!isNaN(checkinDate.getTime())) {
                      const tMinus1 = new Date(checkinDate.getTime() - 24 * 60 * 60 * 1000);
                      const formatted = tMinus1.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                      return `🏠 WhatsApp reminder with check-in instructions will be sent on ${formatted}.`;
                    }
                  } catch {
                    /* fall through */
                  }
                  return "🏠 WhatsApp reminder with check-in instructions will be sent the day before your stay.";
                })()}
              </p>
              <p>
                💬 Need details sooner?{" "}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary font-medium underline underline-offset-2"
                >
                  Chat with host on WhatsApp
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Need help */}
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Need help?</h2>
          <p className="text-sm text-text-secondary">
            Call or WhatsApp us at{" "}
            <a href={`tel:${hostPhoneDigits}`} className="text-brand-primary font-medium">{hostPhone}</a>
            {" "}or email{" "}
            <a href="mailto:atlashomeskphb@gmail.com" className="text-brand-primary font-medium">atlashomeskphb@gmail.com</a>.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 hover:bg-brand-primary/5 transition-colors"
          >
            Chat with host on WhatsApp
          </a>
        </div>

        {/* Add to Calendar (TASK-333) */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Add to your calendar</h2>
            <p className="text-sm text-text-secondary">Save your check-in date and property details to your phone calendar.</p>
            <button
              onClick={downloadCalendar}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 hover:bg-brand-primary/5 transition-colors"
              aria-label="Download calendar event for your stay"
            >
              📅 Add to Calendar
            </button>
          </div>
        )}

        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Trip updates</h2>
            <p className="text-sm text-text-secondary">Get instant alerts on your booking status and check-in reminders.</p>
            <button
              onClick={subscribePush}
              disabled={pushState === "loading" || !supportsPush}
              className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 disabled:opacity-50"
            >
              {pushState === "loading" ? "Enabling..." : "Enable notifications"}
            </button>
            {pushMessage ? <p className={`text-xs ${pushState === "error" ? "text-red-600" : "text-green-700"}`}>{pushMessage}</p> : null}
          </div>
        )}

        {canRequestModification && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Request booking changes</h2>
            <p className="text-sm text-text-secondary">Need a different date or guest count? Send a request and we will review it.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-text-secondary">
                New check-in
                <input type="date" value={modCheckin} onChange={(e) => setModCheckin(e.target.value)} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2.5 text-base" />
              </label>
              <label className="text-sm text-text-secondary">
                New check-out
                <input type="date" value={modCheckout} onChange={(e) => setModCheckout(e.target.value)} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2.5 text-base" />
              </label>
              <label className="text-sm text-text-secondary sm:col-span-2">
                Guest count (optional)
                <input type="number" min={1} value={modGuests} onChange={(e) => setModGuests(e.target.value)} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2.5 text-base" />
              </label>
              <label className="text-sm text-text-secondary sm:col-span-2">
                Note (optional)
                <textarea value={modNote} onChange={(e) => setModNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-2.5 text-base" />
              </label>
            </div>
            <button
              onClick={submitModificationRequest}
              disabled={modSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3.5 disabled:opacity-50"
            >
              {modSubmitting ? "Submitting..." : "Submit request"}
            </button>
            {modMessage ? <p className="text-xs text-text-secondary">{modMessage}</p> : null}
          </div>
        )}

        {/* TASK-350: guest self-service cancellation request */}
        {canRequestModification && !cancelRequested && (
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-red-800">Request cancellation</h2>
            <p className="text-sm text-red-700">
              Cancellations are subject to our cancellation policy. Submitting a request does not
              automatically cancel your booking — our team will review it and contact you within 24 hours.
            </p>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="inline-flex items-center justify-center rounded-lg border border-red-400 text-red-700 text-sm font-medium px-4 py-3 hover:bg-red-100 transition-colors"
                data-testid="request-cancellation-btn"
              >
                Request cancellation
              </button>
            ) : (
              <div className="space-y-3">
                <label className="text-sm text-red-700 block">
                  Reason (optional)
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    placeholder="e.g., change of plans, emergency…"
                    className="mt-1 w-full rounded-md border border-red-200 px-3 py-2 text-sm bg-white"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={submitCancellationRequest}
                    disabled={cancelSubmitting}
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white text-sm font-medium px-4 py-3 disabled:opacity-50 hover:bg-red-700 transition-colors"
                    data-testid="confirm-cancellation-btn"
                  >
                    {cancelSubmitting ? "Submitting…" : "Confirm request"}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {cancelMessage && (
              <p className={`text-xs font-medium ${cancelMessage.includes("submitted") ? "text-green-700" : "text-red-700"}`}>
                {cancelMessage}
              </p>
            )}
          </div>
        )}
        {cancelRequested && (
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 text-sm text-green-800">
            ✅ Cancellation request received. We'll contact you within 24 hours.
          </div>
        )}

        <div className="text-center pt-2 flex flex-col items-center gap-2">
          {bookingId && token && booking?.guestId && (
            <Link
              to={`/my-bookings?guestId=${booking.guestId}&t=${encodeURIComponent(token)}`}
              className="text-sm text-brand-primary underline underline-offset-2 hover:text-brand-primary/80"
            >
              View all my bookings
            </Link>
          )}
          {bookingId && token && (
            <Link
              to={`/profile?bookingId=${bookingId}&t=${encodeURIComponent(token)}`}
              className="text-sm text-brand-primary underline underline-offset-2 hover:text-brand-primary/80"
            >
              Update contact details
            </Link>
          )}
          <Link
            to="/"
            data-testid="confirmation-cta"
            className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            ← Back to Atlas Homestays
          </Link>
        </div>
      </div>
    </>
  );
}
