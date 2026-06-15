import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTenantBrandName } from "../tenant/displayBrand";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react"; // TASK-1476
import SEO from "../components/SEO";
import WeatherWidget from "../components/WeatherWidget";
import ErrorDisplay, { type ErrorResponse as ApiErrorResponse, type RecoveryAction as ApiRecoveryAction } from "../components/ErrorDisplay";
import { track } from "../lib/events";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { getRuntimeConfig, hasRuntimeConfig } from "../runtime-config";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";
import { getContactEmail, getContactPhone } from "../config/contact";
import { useGuestBookingQrToken } from "../hooks/useGuestBookingQrToken";

/** Minimal shape of the non-standard `beforeinstallprompt` event — only `prompt()` is used here. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Guest summary API returns ISO dates or formatted strings (e.g. "Sat, 3 May 2026") — normalize for ICS. */
function summaryDisplayDateToIso(displayDate: string): string {
  const t = displayDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return t;
}

function listingTimeToIcsHHMM(t: string | undefined, fallback: string): string {
  if (!t?.trim()) return fallback;
  const s = t.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return fallback;
}

/** TASK-2490: guest web self-check-in form — posts arrival time + party size + optional ID link. */
function SelfCheckInCard({ bookingId, token }: { bookingId: number; token: string }) {
  const [arrival, setArrival] = useState("");
  const [guests, setGuests] = useState("");
  const [idUrl, setIdUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/guest/bookings/${bookingId}/check-in?t=${encodeURIComponent(token)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
          body: JSON.stringify({
            estimatedArrivalTime: arrival || null,
            guestCount: guests ? Number(guests) : null,
            idDocumentUrl: idUrl.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error("submit failed");
      setDone(true);
    } catch {
      setErr("Could not submit your check-in details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5" data-testid="self-checkin-done">
        <h2 className="text-sm font-semibold text-text-primary mb-1">✓ Check-in details received</h2>
        <p className="text-sm text-text-secondary">Thanks! Your host now has your arrival details.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3" data-testid="self-checkin-card">
      <h2 className="text-sm font-semibold text-text-primary">Web check-in</h2>
      <p className="text-sm text-text-secondary">Share your arrival details so your host can prepare for you.</p>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <label className="block text-sm">
        <span className="text-text-secondary">Estimated arrival time</span>
        <input
          type="time"
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border-subtle px-3 py-3 text-base"
          data-testid="self-checkin-arrival"
        />
      </label>
      <label className="block text-sm">
        <span className="text-text-secondary">Number of guests</span>
        <input
          type="number"
          min={1}
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border-subtle px-3 py-3 text-base"
          data-testid="self-checkin-guests"
        />
      </label>
      <label className="block text-sm">
        <span className="text-text-secondary">ID document link (optional)</span>
        <input
          type="url"
          value={idUrl}
          onChange={(e) => setIdUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 block w-full rounded-lg border border-border-subtle px-3 py-3 text-base"
          data-testid="self-checkin-id"
        />
      </label>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3 hover:bg-brand-primary/90 transition-colors disabled:opacity-70"
        data-testid="self-checkin-submit"
      >
        {submitting ? "Submitting…" : "Submit check-in"}
      </button>
    </div>
  );
}

interface BookingSummary {
  bookingId: number;
  /** Omitted on very old API responses; pre-arrival link hidden if missing. */
  listingId?: number;
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
  /** TASK-1888: server-computed; show pre-arrival checklist when true. */
  preArrivalBriefingVisible?: boolean;
  hoursUntilCheckin?: number;
  checkInTime?: string;
  checkOutTime?: string;
  nearbyLandmarks?: string[];
  /** TASK-1296: guest referral code (e.g. FRIEND42) for the WhatsApp share button. */
  guestReferralCode?: string;
  /** TASK-1490: ISO dates + coordinates for Open-Meteo weather widget. */
  checkinDateIso?: string;
  checkoutDateIso?: string;
  propertyLatitude?: number;
  propertyLongitude?: number;
  /** TASK-1254: Booking reference for self check-in flow (ExternalReservationId or ATL-{id} fallback). */
  bookingRef?: string;
  /** TASK-2071: ISO 639-1 language code from guest profile. Null defaults to "en". */
  preferredLanguage?: string | null;
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border ${s.color}`}>
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

// TASK-2071: pre-arrival UI strings by language
const PRE_ARRIVAL_STRINGS: Record<string, {
  heading: string; intro: string; checkinLabel: string; addressLabel: string;
  hostLabel: string; hostDesc: string; chatBtn: string; wifiLabel: string;
  landmarksLabel: string; viewListing: string; t1Hint: (date: string) => string; t1Fallback: string;
  t1PreviewSummary: string;
  t1PreviewDisclaimer: string;
}> = {
  en: {
    heading: "Before you arrive", intro: "You are checking in soon. Here is a quick reference for your stay — save this page or add to calendar below.",
    checkinLabel: "Check-in & check-out times", addressLabel: "Address", hostLabel: "Host WhatsApp",
    hostDesc: "Questions before you arrive? Message the property team.", chatBtn: "Chat on WhatsApp",
    wifiLabel: "WiFi", landmarksLabel: "Nearby landmarks", viewListing: "View full listing & photos",
    t1Hint: (d) => `🏠 We'll remind you on ${d} with check-in details (typically via WhatsApp or email).`,
    t1Fallback: "🏠 We'll remind you the day before your stay with check-in details.",
    t1PreviewSummary: "Preview the day-before WhatsApp message",
    t1PreviewDisclaimer: "The exact wording may vary; your host may personalize the message before it is sent.",
  },
  hi: {
    heading: "आगमन से पहले", intro: "आप जल्द ही चेक-इन कर रहे हैं। यहाँ आपके प्रवास का त्वरित संदर्भ है — यह पृष्ठ सहेजें या नीचे कैलेंडर में जोड़ें।",
    checkinLabel: "चेक-इन और चेक-आउट का समय", addressLabel: "पता", hostLabel: "होस्ट WhatsApp",
    hostDesc: "आगमन से पहले प्रश्न हैं? संपत्ति टीम को संदेश करें।", chatBtn: "WhatsApp पर चैट करें",
    wifiLabel: "WiFi", landmarksLabel: "नज़दीकी स्थान", viewListing: "पूरी लिस्टिंग और फ़ोटो देखें",
    t1Hint: (d) => `🏠 हम आपको ${d} को चेक-इन विवरण के साथ याद दिलाएंगे (सामान्यतः WhatsApp या ईमेल द्वारा)।`,
    t1Fallback: "🏠 हम आपके प्रवास के एक दिन पहले चेक-इन विवरण के साथ याद दिलाएंगे।",
    t1PreviewSummary: "एक दिन पहले भेजे जाने वाले WhatsApp संदेश का पूर्वावलोकन",
    t1PreviewDisclaimer: "वास्तविक शब्द भिन्न हो सकते हैं; आपका होस्ट भेजने से पहले संदेश को अनुकूलित कर सकता है।",
  },
  te: {
    heading: "రాక ముందు", intro: "మీరు త్వరలో చెక్-ఇన్ చేస్తున్నారు. ఇది మీ వసతికి త్వరిత సూచన — ఈ పేజీని సేవ్ చేయండి లేదా క్రింద క్యాలెండర్‌కు జోడించండి।",
    checkinLabel: "చెక్-ఇన్ మరియు చెక్-అవుట్ సమయాలు", addressLabel: "చిరునామా", hostLabel: "హోస్ట్ WhatsApp",
    hostDesc: "రాకముందు ప్రశ్నలు ఉన్నాయా? ఆస్తి బృందాన్ని సందేశించండి।", chatBtn: "WhatsApp లో చాట్ చేయండి",
    wifiLabel: "WiFi", landmarksLabel: "సమీప ప్రదేశాలు", viewListing: "పూర్తి లిస్టింగ్ & ఫోటోలు చూడండి",
    t1Hint: (d) => `🏠 మేము ${d}న చెక్-ఇన్ వివరాలతో మీకు గుర్తు చేస్తాము (సాధారణంగా WhatsApp లేదా ఇమెయిల్ ద్వారా).`,
    t1Fallback: "🏠 మేము మీ వసతికి ముందు రోజు చెక్-ఇన్ వివరాలతో గుర్తు చేస్తాము.",
    t1PreviewSummary: "ముందురోజు WhatsApp సందేశాన్ని చూడండి",
    t1PreviewDisclaimer: "నిజమైన పదాలు మారవచ్చు; పంపే ముందు మీ హోస్ట్ సందేశాన్ని సవరించవచ్చు.",
  },
};

/** TASK-1680: sample body for T-1 reminder (not server-rendered template). */
function truncateForPreview(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildTMinus1WhatsAppPreviewBody(booking: BookingSummary): string {
  const guest = booking.guestName?.trim() || "Guest";
  const place = (booking.listingName || booking.propertyName || "your stay").trim();
  const cin = booking.checkInTime?.trim();
  const cout = booking.checkOutTime?.trim();
  let checkinLine: string;
  try {
    const d = new Date(booking.checkinDate);
    const datePretty = !isNaN(d.getTime())
      ? d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" })
      : booking.checkinDate;
    if (cin && cout) checkinLine = `${cin} – ${cout} (${datePretty})`;
    else if (cin) checkinLine = `${cin} (${datePretty})`;
    else checkinLine = datePretty;
  } catch {
    checkinLine = booking.checkinDate;
  }

  const lines: string[] = [];
  lines.push(`Hi ${guest},`);
  lines.push("");
  lines.push(`We're looking forward to welcoming you tomorrow at ${place}.`);
  lines.push("");
  lines.push(`Check-in: ${checkinLine}`);
  if (booking.propertyAddress?.trim()) {
    lines.push(`Address: ${booking.propertyAddress.trim()}`);
  }
  const ins = (booking.checkinInstructions || "").trim();
  if (ins) {
    lines.push(`Directions / access: ${truncateForPreview(ins, 320)}`);
  }
  if (booking.wifiVisible && booking.wifiName?.trim()) {
    lines.push(
      booking.wifiPassword?.trim()
        ? `Wi-Fi: ${booking.wifiName.trim()} · Password: ${booking.wifiPassword.trim()}`
        : `Wi-Fi network: ${booking.wifiName.trim()}`,
    );
  }
  lines.push("");
  lines.push("—");
  lines.push("(Sample preview — your host sends the final message.)");
  return lines.join("\n");
}

interface ListingAddOnPublic {
  addOnServiceId: number;
  name: string;
  description?: string | null;
  price: number;
  priceType: string;
  category?: string | null;
}

interface BookingPaymentStatusResponse {
  status: "Pending" | "Failed" | "Paid";
  failureReason?: string;
  failedAtUtc?: string;
  retryUrl?: string;
  bookingStatus?: string;
  holdExpiresAtUtc?: string | null;
}

type ApiErrorEnvelope = ApiErrorResponse & {
  recoveryActions?: ApiRecoveryAction[];
};

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");
  const bookingIdNum = bookingId ? Number(bookingId) : undefined;
  const { qrToken, expiresAtUtc: qrExpiresAtUtc } = useGuestBookingQrToken(
    Number.isFinite(bookingIdNum) ? bookingIdNum : undefined,
    token ?? undefined,
  );
  const qrEncodeToken = qrToken ?? token;
  const brandName = getTenantBrandName();

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [addOns, setAddOns] = useState<ListingAddOnPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorPayload, setErrorPayload] = useState<ApiErrorEnvelope | null>(null);
  const [pushState, setPushState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pushMessage, setPushMessage] = useState<string>("");
  const [modCheckin, setModCheckin] = useState("");
  const [modCheckout, setModCheckout] = useState("");
  const [modGuests, setModGuests] = useState("");
  const [modNote, setModNote] = useState("");
  const [modSubmitting, setModSubmitting] = useState(false);
  const [modMessage, setModMessage] = useState<string>("");
  interface ModRequestSummary { id: number; requestedCheckinDateUtc: string; requestedCheckoutDateUtc: string; requestedGuestCount?: number | null; note?: string | null; status: string; decisionNote?: string | null; decisionMadeAtUtc?: string | null; createdAtUtc: string; }
  const [modRequests, setModRequests] = useState<ModRequestSummary[]>([]);
  // TASK-350: guest self-service cancellation request
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string>("");
  const [cancelRequested, setCancelRequested] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copyRefFeedback, setCopyRefFeedback] = useState(false);
  const [copyRefManual, setCopyRefManual] = useState(false);
  const [shareLanguage, setShareLanguage] = useState<"en" | "hi" | "te">("en");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [paymentFailureReason, setPaymentFailureReason] = useState<string | null>(null);
  const [paymentFailedAt, setPaymentFailedAt] = useState<string | null>(null);
  const [paymentRetryUrl, setPaymentRetryUrl] = useState<string | null>(null);
  const [paymentCheckManual, setPaymentCheckManual] = useState(false);
  const [paymentPollAttempt, setPaymentPollAttempt] = useState(0);
  const [paymentPollExhausted, setPaymentPollExhausted] = useState(false);
  const [lastPaymentCheckAt, setLastPaymentCheckAt] = useState<Date | null>(null);
  const [relativeNowMs, setRelativeNowMs] = useState(() => Date.now());
  const [pwaInstallDismissed, setPwaInstallDismissed] = useState(() => {
    try { return localStorage.getItem("atlas_guest_pwa_install_dismissed_v1") === "1"; } catch { return false; }
  });
  const pwaInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const pollAttemptsRef = useRef(0);
  const statusKeyRef = useRef<string | null>(null);
  const isPageUnloadRef = useRef(false);

  const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  const isIosNonPwa = isIos && !isStandalone;

  const mapErrorCodeToRecoveryActions = (
    code: string | undefined,
    paymentRetryLink: string | null
  ): ApiRecoveryAction[] => {
    const normalized = (code ?? "").trim().toUpperCase();
    if (normalized === "DATE_NO_LONGER_AVAILABLE") {
      return [{ actionType: "SEARCH_AGAIN", actionLabel: "Search Again", actionUrl: "/search" }];
    }
    if (normalized === "PAYMENT_DECLINED") {
      return paymentRetryLink
        ? [{ actionType: "RETRY_PAYMENT", actionLabel: "Retry Payment", actionUrl: paymentRetryLink }]
        : [{ actionType: "RETRY_PAYMENT", actionLabel: "Retry Payment", delaySeconds: 5 }];
    }
    if (normalized === "PAYMENT_TIMEOUT") {
      return [
        ...(paymentRetryLink ? [{ actionType: "RETRY_PAYMENT" as const, actionLabel: "Retry Payment", actionUrl: paymentRetryLink }] : []),
        { actionType: "CONTACT_SUPPORT", actionLabel: "Contact Support", actionUrl: "/contact" },
      ];
    }
    if (normalized === "LISTING_NOT_FOUND") {
      return [{ actionType: "SEARCH_AGAIN", actionLabel: "Browse All", actionUrl: "/search" }];
    }
    return [{ actionType: "CONTACT_SUPPORT", actionLabel: "Contact Support", actionUrl: "/contact" }];
  };

  const handleRecoveryActionClick = (action: ApiRecoveryAction) => {
    track(`booking_error_action_${action.actionType.toLowerCase()}`);
    if (action.actionType === "RETRY_PAYMENT" && paymentRetryUrl && !action.actionUrl) {
      window.open(paymentRetryUrl, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); pwaInstallPromptRef.current = e as BeforeInstallPromptEvent; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
        if (res.status === 404) {
          const parsed404 = await res.clone().json().catch(() => null) as ApiErrorEnvelope | null;
          if (parsed404?.code && parsed404?.message) setErrorPayload(parsed404);
          throw new Error("Booking not found. Please check your confirmation email for the correct link.");
        }
        if (!res.ok) {
          const parsed = await res.clone().json().catch(() => null) as ApiErrorEnvelope | null;
          if (parsed?.code && parsed?.message) {
            setErrorPayload(parsed);
          }
          throw new Error(await messageFromApiResponse(res));
        }
        return res.json() as Promise<BookingSummary>;
      })
      .then((b) => {
        setBooking(b);
        // TASK-1480: confirmed = guest views booking confirmation page
        track('confirmed', b.listingId);
        // Fetch prior modification requests (best-effort, non-blocking)
        fetch(buildApiUrl(`/api/public/bookings/${bookingId}/modification-requests?t=${encodeURIComponent(token)}`), {
          headers: { Accept: "application/json", ...getApiHeaders() },
        })
          .then((r) => r.ok ? r.json() : Promise.resolve([]))
          .then((data: unknown) => { if (Array.isArray(data)) setModRequests(data); })
          .catch(() => {});
        // TASK-1376: fetch listing add-ons for post-payment upsell (best-effort, non-blocking)
        if (b.listingId != null && b.listingId > 0) {
          fetch(buildApiUrl(`/listings/${b.listingId}/add-ons`), {
            headers: { Accept: "application/json", ...getApiHeaders() },
          })
            .then((r) => r.ok ? r.json() : Promise.resolve([]))
            .then((data: unknown) => { if (Array.isArray(data)) setAddOns(data as ListingAddOnPublic[]); })
            .catch(() => {});
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setError("We couldn't load your booking — please try again.");
      })
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  useEffect(() => {
    if (!errorPayload?.code) return;
    track(`booking_error_${errorPayload.code.toLowerCase()}`);
  }, [errorPayload]);

  const updatePaymentStateFromBody = useCallback(
    (body: BookingPaymentStatusResponse) => {
      const normalized = (body.status || "Pending").toLowerCase();
      if (normalized === "paid") {
        setPaymentStatus("success");
        setPaymentFailureReason(null);
        setPaymentFailedAt(null);
        setPaymentRetryUrl(null);
        return "success" as const;
      }
      if (normalized === "failed") {
        setPaymentStatus("failed");
        const reason = body.failureReason ?? "Payment was declined by the bank or gateway.";
        setPaymentFailureReason(reason);
        setPaymentFailedAt(body.failedAtUtc ?? null);
        setPaymentRetryUrl(body.retryUrl ?? null);
        setErrorPayload({
          code: "PAYMENT_DECLINED",
          message: "Your card was declined. Try another payment method or contact support.",
          details: reason,
          recoveryActions: mapErrorCodeToRecoveryActions("PAYMENT_DECLINED", body.retryUrl ?? null),
        });
        return "failed" as const;
      }
      setPaymentStatus("pending");
      return "pending" as const;
    },
    [],
  );

  const fetchPaymentStatus = useCallback(async () => {
    if (!bookingId || !token) return "pending" as const;
    pollAttemptsRef.current += 1;
    setPaymentPollAttempt(pollAttemptsRef.current);
    try {
      const res = await fetch(
        buildApiUrl(`/bookings/${bookingId}/payment-status?t=${encodeURIComponent(token)}`),
        { headers: { Accept: "application/json", ...getApiHeaders() } },
      );
      if (!res.ok) {
        setLastPaymentCheckAt(new Date());
        return "pending" as const;
      }
      const body = (await res.json()) as BookingPaymentStatusResponse;
      setLastPaymentCheckAt(new Date());
      return updatePaymentStateFromBody(body);
    } catch {
      setLastPaymentCheckAt(new Date());
      return "pending" as const;
    }
  }, [bookingId, token, updatePaymentStateFromBody]);

  useEffect(() => {
    if (!bookingId || !token) return;

    const maxAttempts = 150; // 5m / 2s
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const storageKey = `booking_${bookingId}_payment_status`;
    statusKeyRef.current = storageKey;
    pollAttemptsRef.current = 0;
    setPaymentPollAttempt(0);
    setPaymentPollExhausted(false);

    try {
      const cached = sessionStorage.getItem(storageKey)?.toLowerCase();
      if (cached === "success") {
        setPaymentStatus("success");
        return;
      }
      if (cached === "failed") {
        setPaymentStatus("failed");
      }
    } catch {
      // ignore unavailable sessionStorage
    }

    const runPoll = async () => {
      const current = await fetchPaymentStatus();
      if (cancelled) return;
      if (current === "success" || current === "failed") return;
      if (pollAttemptsRef.current >= maxAttempts) {
        setPaymentPollExhausted(true);
        return;
      }
      timer = setTimeout(runPoll, 2000);
    };

    void runPoll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bookingId, token, fetchPaymentStatus]);

  useEffect(() => {
    const tick = window.setInterval(() => setRelativeNowMs(Date.now()), 30000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const key = statusKeyRef.current;
    if (!key) return;
    try {
      sessionStorage.setItem(key, paymentStatus);
    } catch {
      // ignore unavailable sessionStorage
    }
  }, [paymentStatus]);

  useEffect(() => {
    const persistBeforeUnload = () => {
      isPageUnloadRef.current = true;
      const key = statusKeyRef.current;
      if (!key) return;
      try {
        sessionStorage.setItem(key, paymentStatus);
      } catch {
        // ignore unavailable sessionStorage
      }
    };
    window.addEventListener("beforeunload", persistBeforeUnload);
    return () => window.removeEventListener("beforeunload", persistBeforeUnload);
  }, [paymentStatus]);

  useEffect(() => {
    return () => {
      if (isPageUnloadRef.current) return;
      const key = statusKeyRef.current;
      if (!key) return;
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore unavailable sessionStorage
      }
    };
  }, []);

  async function runManualPaymentStatusCheck() {
    setPaymentCheckManual(true);
    await fetchPaymentStatus();
    setPaymentCheckManual(false);
  }

  function formatRelativeLastCheck(lastChecked: Date | null): string {
    if (!lastChecked) return "Not checked yet";
    const diffMs = Math.max(0, relativeNowMs - lastChecked.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    return `${mins} min ago`;
  }

  const modCheckinError = useMemo(() => {
    if (modCheckin.length < 10) return "";
    const todayIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    if (modCheckin < todayIst) return "Check-in cannot be a past date";
    return "";
  }, [modCheckin]);

  const modCheckoutError = useMemo(() => {
    if (modCheckout.length < 10 || modCheckin.length < 10) return "";
    if (modCheckout <= modCheckin) return "Check-out must be after check-in";
    const a = new Date(`${modCheckin}T12:00:00`).getTime();
    const b = new Date(`${modCheckout}T12:00:00`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return "";
    const nights = (b - a) / 86400000;
    if (nights < 1) return "Minimum stay is 1 night (check-out must be the day after check-in or later).";
    return "";
  }, [modCheckin, modCheckout]);

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

  const voucherUrl =
    bookingId && token
      ? buildApiUrl(`/api/guest/bookings/${bookingId}/voucher?t=${encodeURIComponent(token)}`)
      : "";

  if (error || !booking) {
    const computedErrorPayload: ApiErrorEnvelope = errorPayload ?? {
      code: "SERVER_ERROR",
      message: error ?? "We could not load your booking details.",
      details: "Try again in a moment or contact support if this continues.",
      recoveryActions: mapErrorCodeToRecoveryActions(undefined, paymentRetryUrl),
    };
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h1 className="text-xl font-bold text-text-primary">Booking not found</h1>
          <ErrorDisplay
            error={{
              ...computedErrorPayload,
              recoveryActions: computedErrorPayload.recoveryActions?.length
                ? computedErrorPayload.recoveryActions
                : mapErrorCodeToRecoveryActions(computedErrorPayload.code, paymentRetryUrl),
            }}
            onActionClick={handleRecoveryActionClick}
          />
          <Link to="/" className="inline-block mt-2 text-sm text-brand-primary underline underline-offset-2">Return to homepage</Link>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "Cancelled";
  // TASK-2071: pick language strings from guest profile preference
  const langCode = (booking.preferredLanguage ?? "en").toLowerCase();
  const pa = PRE_ARRIVAL_STRINGS[langCode] ?? PRE_ARRIVAL_STRINGS.en;
  const hasRealHostPhone = !!booking.propertyPhone?.trim();
  const hostPhone = hasRealHostPhone ? booking.propertyPhone!.trim() : `+91${getContactPhone()}`;
  const hostPhoneDigits = hostPhone.replace(/[^\d+]/g, "");
  const whatsappDigits = hostPhoneDigits.replace(/^\+/, "");
  const supportEmail = getContactEmail();
  const confirmationNotifyPhone = "";
  const whatsappText = encodeURIComponent(`Hi, I have a question about booking #${booking.bookingId}.`);
  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${whatsappText}`;
  const supportsPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const canRequestModification = !isCancelled && !!token;
  const hasPendingModRequest = modRequests.some((r) => r.status === "Pending");

  const modDatesInvalid = Boolean(modCheckinError || modCheckoutError);

  // TASK-333: Generate and download ICS calendar event for check-in
  function downloadCalendar() {
    if (!booking) return;
    const formatIcsDate = (dateStr: string, timeStr: string) => {
      // dateStr is YYYY-MM-DD, timeStr is HH:MM (24h IST)
      const [y, m, d] = dateStr.split("-");
      const [h, min] = timeStr.split(":");
      // Store as floating time (no timezone conversion needed — IST local)
      return `${y}${m}${d}T${h}${min}00`;
    };
    const cinIso = summaryDisplayDateToIso(booking.checkinDate);
    const coutIso = summaryDisplayDateToIso(booking.checkoutDate);
    const cinTime = listingTimeToIcsHHMM(booking.checkInTime, "14:00");
    const coutTime = listingTimeToIcsHHMM(booking.checkOutTime, "12:00");
    const checkin = formatIcsDate(cinIso, cinTime);
    const checkout = formatIcsDate(coutIso, coutTime);
    const uid = `atlas-booking-${booking.bookingId}@atlashomestays.com`; // eslint-disable-line atlas-brand/no-atlas-string-leak -- iCal UID domain, not user-visible
    const tenantName = brandName;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${tenantName}//BookingConfirmation//EN`,
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
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      setPushState("done");
      setPushMessage("Notifications enabled. We'll send important booking updates.");
    } catch (e) {
      setPushState("error");
      setPushMessage(
        e instanceof Error && e.message
          ? e.message
          : "Notifications could not be enabled. Try again or use another browser.",
      );
    }
  }

  async function submitModificationRequest() {
    if (!bookingId || !token) return;
    setModMessage("");
    if (!modCheckin || !modCheckout) {
      setModMessage("Please enter both check-in and check-out dates.");
      return;
    }
    if (modCheckinError || modCheckoutError) {
      setModMessage(modCheckinError || modCheckoutError);
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
        throw new Error(await messageFromApiResponse(res));
      }
      const created = await res.json() as ModRequestSummary;
      setModRequests((prev) => [created, ...prev]);
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
        throw new Error(await messageFromApiResponse(res));
      }
      setCancelRequested(true);
      setCancelMessage("");
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
          <p className="text-sm text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Ref&nbsp;<span className="font-mono font-semibold text-text-primary" data-testid="booking-reference">#{booking.bookingId}</span>
            </span>
            <button
              type="button"
              data-testid="booking-reference-copy"
              onClick={async () => {
                const refText = String(booking.bookingId);
                setCopyRefManual(false);
                try {
                  await navigator.clipboard.writeText(refText);
                  setCopyRefFeedback(true);
                  window.setTimeout(() => setCopyRefFeedback(false), 2000);
                  return;
                } catch {
                  /* fall through to legacy copy */
                }
                try {
                  const ta = document.createElement('textarea');
                  ta.value = refText;
                  ta.setAttribute('readonly', '');
                  ta.style.position = 'fixed';
                  ta.style.left = '-9999px';
                  document.body.appendChild(ta);
                  ta.select();
                  const ok = document.execCommand('copy');
                  document.body.removeChild(ta);
                  if (ok) {
                    setCopyRefFeedback(true);
                    window.setTimeout(() => setCopyRefFeedback(false), 2000);
                    return;
                  }
                } catch {
                  /* ignore */
                }
                setCopyRefFeedback(false);
                setCopyRefManual(true);
              }}
              className="text-sm font-medium text-brand-primary underline underline-offset-2 rounded px-1 py-3 hover:bg-brand-primary/5"
            >
              {copyRefFeedback ? "Copied!" : copyRefManual ? `Select #${booking.bookingId}` : "Copy ID"}
            </button>
            <span className="hidden sm:inline">&middot;</span>
            <span>{booking.listingName !== booking.propertyName ? booking.listingName : booking.propertyName}</span>
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

        {paymentStatus === "pending" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1" data-testid="payment-polling-status">
            <p className="text-sm text-amber-800 font-medium">Checking payment... attempt {paymentPollAttempt}/150</p>
            {paymentPollExhausted && (
              <>
                <p className="text-sm text-amber-800">
                  Payment is taking longer than usual — check your email for a confirmation, or tap below to refresh.
                </p>
                <button
                  type="button"
                  onClick={() => { void runManualPaymentStatusCheck(); }}
                  className="mt-1 text-sm font-medium text-amber-900 underline underline-offset-2"
                >
                  Check status again
                </button>
              </>
            )}
          </div>
        )}

        {paymentStatus === "failed" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3" data-testid="payment-failed-card">
            <h2 className="text-sm font-semibold text-red-800">Payment failed</h2>
            <p className="text-sm text-red-700">
              Payment failed: {paymentFailureReason ?? "Your payment could not be completed."}
            </p>
            {paymentFailedAt && (
              <p className="text-sm text-red-700/80">
                Failed at: {new Date(paymentFailedAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {paymentStatus === "failed" && paymentRetryUrl ? (
                <button
                  type="button"
                  onClick={() => window.open(paymentRetryUrl, "_blank", "noopener,noreferrer")}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 text-white text-sm font-medium px-4 py-3 hover:bg-red-700 transition-colors"
                  data-testid="retry-payment-btn-manual"
                >
                  Retry Payment
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => { void runManualPaymentStatusCheck(); }}
                disabled={paymentCheckManual}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 text-red-800 text-sm font-medium px-4 py-3 hover:bg-red-100 transition-colors disabled:opacity-70"
                data-testid="check-payment-status-btn"
              >
                {paymentCheckManual ? (
                  <>
                    <span className="w-4 h-4 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" aria-hidden />
                    Checking...
                  </>
                ) : (
                  "Check payment status"
                )}
              </button>
              <span className="text-sm text-red-700/80" data-testid="payment-last-checked">
                Last checked: {formatRelativeLastCheck(lastPaymentCheckAt)}
              </span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-red-800 underline underline-offset-2"
              >
                Contact Support
              </a>
            </div>
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
          {canRequestModification && (
            <div className="pt-4 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => document.getElementById("booking-change-request")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand-primary underline underline-offset-2 rounded px-1 py-3 hover:bg-brand-primary/5"
                data-testid="modify-dates-link"
              >
                Need different dates?
              </button>
            </div>
          )}
        </div>

        {/* TASK-1476: QR check-in code — guests can scan on arrival to confirm identity */}
        {!isCancelled && token && qrEncodeToken && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-5 flex flex-col items-center gap-3" data-testid="confirmation-qr-section">
            <QRCodeSVG
              value={`${window.location.origin}/booking/${bookingId}?t=${encodeURIComponent(qrEncodeToken)}`}
              size={180}
              bgColor="#ffffff"
              fgColor="#0F172A"
              level="M"
              aria-label={`QR code for booking #${bookingId}`}
            />
            <p className="text-sm text-center text-text-secondary max-w-xs">
              Show this to the host on arrival
            </p>
            {qrToken && qrExpiresAtUtc ? (
              <p className="text-xs text-center text-text-muted max-w-xs" data-testid="confirmation-qr-expiry">
                This code refreshes automatically and expires at{" "}
                {new Date(qrExpiresAtUtc).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.
              </p>
            ) : null}
            <p className="text-xs text-center text-support-error/80 max-w-xs">
              Don't share this QR publicly — anyone who scans it can access your booking details.
            </p>
          </div>
        )}

        {/* TASK-1490: Weather forecast for stay dates */}
        {!isCancelled && booking.propertyLatitude != null && booking.propertyLongitude != null &&
          booking.checkinDateIso && booking.checkoutDateIso && (
          <WeatherWidget
            lat={booking.propertyLatitude}
            lng={booking.propertyLongitude}
            fromDate={booking.checkinDateIso}
            toDate={booking.checkoutDateIso}
          />
        )}

        {/* TASK-2091: placeholder while invoice is being generated */}
        {!isCancelled && booking.status === 'Confirmed' && !booking.hasGstInvoice && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">GST invoice</h2>
            <p className="text-sm text-text-secondary">
              Your GST invoice is being generated — we'll send it to your email within 1 hour.
            </p>
            <p className="text-xs text-text-muted">
              Accommodation is billed under SAC&nbsp;9963 (hotel and similar accommodation services) as applicable for Indian GST.
            </p>
          </div>
        )}

        {/* Documents: GST invoice + booking voucher grouped */}
        {!isCancelled && ((booking.hasGstInvoice && pdfUrl) || voucherUrl) && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">Documents</h2>
            {booking.hasGstInvoice && pdfUrl && (
              <div className="space-y-3">
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
                  Download GST invoice (PDF, ~80 KB)
                </a>
              </div>
            )}
            {voucherUrl && (
              <div className={`space-y-2 ${booking.hasGstInvoice && pdfUrl ? "pt-4 border-t border-border-subtle" : ""}`}>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Booking confirmation voucher — print or share as proof of booking. Present it during check-in.
                </p>
                <a
                  href={voucherUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="download-voucher-btn"
                  className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3.5 hover:bg-brand-primary/5 transition-colors"
                >
                  Download voucher (PDF, ~80 KB)
                </a>
              </div>
            )}
          </div>
        )}

        {/* Check-in info — TASK-2878: times + map always visible; briefing adds richer near-arrival detail */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Check-in details</h2>
            {(booking.checkInTime || booking.checkOutTime) && (
              <div className="text-sm text-text-primary">
                {booking.checkInTime ? (
                  <p>
                    Check-in from <span className="font-semibold">{booking.checkInTime}</span>
                  </p>
                ) : null}
                {booking.checkOutTime ? (
                  <p className="text-text-secondary mt-0.5">
                    Check-out by <span className="font-medium text-text-primary">{booking.checkOutTime}</span>
                  </p>
                ) : null}
              </div>
            )}
            {booking.propertyAddress ? (
              <div className="space-y-1">
                <p className="text-sm text-text-primary whitespace-pre-wrap">{booking.propertyAddress}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.propertyAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-primary font-medium underline underline-offset-2 w-fit inline-block"
                  data-testid="confirmation-open-maps"
                >
                  Open in Google Maps
                </a>
              </div>
            ) : null}
            <div className="space-y-0">
              {booking.checkinInstructions && (
                <InfoRow label="Check-in instructions" value={booking.checkinInstructions} />
              )}
              {booking.propertyPhone && (
                <InfoRow label="Property contact" value={booking.propertyPhone} />
              )}
              {!booking.checkinInstructions && !booking.propertyPhone && !booking.propertyAddress && (
                <p className="text-sm text-text-secondary">Check-in instructions will be sent to you 24 hours before arrival.</p>
              )}
            </div>
          </div>
        )}

        {/* TASK-2490: guest web self-check-in */}
        {!isCancelled && bookingId && token && (
          <SelfCheckInCard bookingId={Number(bookingId)} token={token} />
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

        {/* TASK-4086: nearby landmarks — non-sensitive context shown immediately, not gated on 72h window */}
        {!isCancelled && Array.isArray(booking.nearbyLandmarks) && booking.nearbyLandmarks.length > 0 && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">📍 {pa.landmarksLabel}</h2>
            <ul className="list-disc pl-5 text-sm text-text-primary space-y-1">
              {booking.nearbyLandmarks.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* TASK-1888: pre-arrival briefing (confirmed stays within 72h) */}
        {!isCancelled && booking.preArrivalBriefingVisible && (
          <section
            className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 space-y-4"
            data-testid="pre-arrival-briefing"
            aria-label="Before you arrive"
          >
            <h2 className="text-sm font-semibold text-text-primary">{pa.heading}</h2>
            <p className="text-xs text-text-secondary leading-relaxed">{pa.intro}</p>
            <div className="space-y-0 divide-y divide-amber-200/60 border-t border-amber-200/60 -mx-5 px-5">
              {(booking.checkInTime || booking.checkOutTime) && (
                <div className="flex flex-col gap-0.5 py-3">
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{pa.checkinLabel}</span>
                  <span className="text-sm text-text-primary">
                    {booking.checkInTime
                      ? <>Check-in from <span className="font-semibold">{booking.checkInTime}</span></>
                      : "Check-in time: your host will confirm (see WhatsApp or instructions)."}
                    {booking.checkOutTime ? (
                      <span className="block mt-1 text-text-secondary">
                        Check-out by <span className="font-medium text-text-primary">{booking.checkOutTime}</span>
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
              {booking.propertyAddress ? (
                <div className="flex flex-col gap-1.5 py-3">
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{pa.addressLabel}</span>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{booking.propertyAddress}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.propertyAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-primary font-medium underline underline-offset-2 w-fit"
                    data-testid="pre-arrival-open-maps"
                  >
                    Open in Google Maps
                  </a>
                </div>
              ) : null}
              <div className="py-3">
                <span className="text-xs text-text-muted uppercase tracking-wider font-medium">
                  {hasRealHostPhone ? pa.hostLabel : 'Support'}
                </span>
                <p className="text-sm text-text-secondary mt-1">{pa.hostDesc}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-[#25D366] text-white text-sm font-medium px-4 py-3 hover:opacity-95 transition-opacity"
                    data-testid="pre-arrival-whatsapp"
                  >
                    {hasRealHostPhone ? pa.chatBtn : `Chat with ${brandName} support`}
                  </a>
                  <a
                    href={`mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(`Question before check-in — booking #${booking.bookingId}`)}`}
                    className="inline-flex items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-text-primary text-sm font-medium px-4 py-3 hover:bg-bg-muted/60 transition-colors"
                    data-testid="pre-arrival-email-host"
                  >
                    Email us
                  </a>
                </div>
              </div>
              {booking.wifiVisible && (booking.wifiName || booking.wifiPassword) && (
                <div className="py-3">
                  <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{pa.wifiLabel}</span>
                  <p className="text-sm text-text-primary mt-1">
                    {booking.wifiName ? (
                      <>Network <span className="font-mono font-semibold">{booking.wifiName}</span></>
                    ) : (
                      "Network name is in the WiFi section above."
                    )}
                    {booking.wifiPassword ? (
                      <span className="block text-text-secondary text-xs mt-0.5">Password: see WiFi card above.</span>
                    ) : null}
                  </p>
                </div>
              )}
            </div>
            {booking.listingId != null && booking.listingId > 0 && (
              <Link
                to={buildHomeUnitPath(getPropertySlug({ property_name: booking.propertyName }), booking.listingId)}
                className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 hover:bg-brand-primary/5 transition-colors"
                data-testid="pre-arrival-view-listing"
              >
                {pa.viewListing}
              </Link>
            )}
          </section>
        )}

        {/* TASK-1254: Self check-in card — available any time after confirmation */}
        {!isCancelled && booking.bookingRef &&
          (booking.status === 'Confirmed' || booking.status === 'CheckedIn') && (
          <Link
            to={`/check-in/${encodeURIComponent(booking.bookingRef)}`}
            data-testid="self-checkin-link"
            className="flex items-center justify-between gap-4 rounded-2xl border border-brand-primary/40 bg-brand-primary/5 p-5 hover:bg-brand-primary/10 transition-colors"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-text-primary">Self check-in</p>
              <p className="text-xs text-text-secondary">Skip the queue — submit your ID and sign house rules online before you arrive.</p>
            </div>
            <span className="shrink-0 text-brand-primary text-lg" aria-hidden>→</span>
          </Link>
        )}

        {/* TASK-2082: PWA install nudge — only within 72h of check-in, only when prompt is available */}
        {!isCancelled && booking.preArrivalBriefingVisible && !pwaInstallDismissed && !isIosNonPwa && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-bg-muted/60 px-4 py-3 text-sm">
            <span>📱 Save {getTenantBrandName()} to your home screen for quick access during your stay</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-3 py-3 hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (pwaInstallPromptRef.current) {
                    pwaInstallPromptRef.current.prompt();
                  }
                }}
              >
                Install
              </button>
              <button
                type="button"
                className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
                onClick={() => {
                  try { localStorage.setItem("atlas_guest_pwa_install_dismissed_v1", "1"); } catch { /* ignore */ }
                  setPwaInstallDismissed(true);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* What happens next */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-3">What happens next</h2>
            <div className="space-y-2.5 text-sm text-text-secondary">
              {/* TASK-2876: gate the "confirmed" affirmation on payment capture; show "Finalizing" while the poll runs so the page doesn't contradict the amber "Checking payment" banner. */}
              {paymentStatus === "success" ? (
                <>
                  <p data-testid="booking-confirmed-affirmation">✅ Booking confirmed now.</p>
                  <p>
                    📱 SMS and WhatsApp confirmation should arrive shortly
                    {confirmationNotifyPhone ? (
                      <> at <span className="font-medium text-text-primary">{confirmationNotifyPhone}</span></>
                    ) : (
                      <> on the phone number you entered at checkout</>
                    )}
                    .
                  </p>
                </>
              ) : paymentStatus === "pending" ? (
                <p data-testid="booking-finalizing-payment">
                  {paymentPollExhausted
                    ? "⏳ Payment is taking longer than usual — tap \"Check status again\" above or check your email for a confirmation."
                    : "⏳ Finalizing your booking — we're confirming your payment. This usually takes a few moments."}
                </p>
              ) : (
                <p>⚠️ Your payment hasn't completed yet. Please complete payment above to confirm your booking.</p>
              )}
              <p data-testid="confirmation-t-minus-1">
                {/* TASK-546 + TASK-2071: Explicit T-1 WhatsApp reminder date, language-aware */}
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
                      return pa.t1Hint(formatted);
                    }
                  } catch {
                    /* fall through */
                  }
                  return pa.t1Fallback;
                })()}
              </p>
              {/* TASK-1680: collapsible sample of day-before WhatsApp reminder */}
              <details
                className="rounded-xl border border-border-subtle bg-bg-muted/50 px-3 py-2"
                data-testid="confirmation-t-minus-1-preview"
              >
                <summary className="cursor-pointer text-xs font-semibold text-text-primary select-none">
                  {pa.t1PreviewSummary}
                </summary>
                <p className="mt-2 text-xs text-text-muted leading-relaxed">{pa.t1PreviewDisclaimer}</p>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-bg-surface border border-border-subtle p-3 font-sans text-xs text-text-secondary leading-relaxed">
                  {buildTMinus1WhatsAppPreviewBody(booking)}
                </pre>
              </details>
              <p>
                💬 Need details sooner?{" "}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary font-medium underline underline-offset-2"
                >
                  {hasRealHostPhone ? 'Chat with host on WhatsApp' : `Chat with ${brandName} support`}
                </a>
                {" "}or{" "}
                <a
                  href={`mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(`Booking #${booking.bookingId} — question`)}`}
                  className="text-brand-primary font-medium underline underline-offset-2"
                >
                  email us
                </a>
                .
              </p>
              {/* TASK-1387: build review expectation at confirmation time */}
              <p>⭐ After your stay, we'll ask you to share a quick review — it helps future guests and your host.</p>
            </div>
          </div>
        )}

        {/* TASK-1376: Add-on upsell — only when listing has active add-ons and booking is not cancelled */}
        {!isCancelled && addOns.length > 0 && (
          <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-5">
            <h2 className="text-sm font-semibold text-text-primary mb-1">Make your stay even better</h2>
            <p className="text-xs text-text-secondary mb-3">Our team will confirm via WhatsApp after you send a request.</p>
            <div className="space-y-3">
              {addOns.slice(0, 3).map((addOn) => {
                const priceLabel = addOn.priceType === 'per_night' ? '/night'
                  : addOn.priceType === 'per_guest' ? '/guest'
                  : '';
                const addOnText = encodeURIComponent(
                  `Hi, I just booked #${booking!.bookingId} and I'd like to add: ${addOn.name} (${booking!.currency} ${addOn.price}${priceLabel}). Please confirm.`
                );
                const addOnWhatsapp = `https://wa.me/${whatsappUrl.split('/')[3].split('?')[0]}?text=${addOnText}`;
                return (
                  <div key={addOn.addOnServiceId} className="flex items-center justify-between gap-3 bg-bg-surface rounded-xl border border-border-subtle px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{addOn.name}</p>
                      {addOn.description && <p className="text-xs text-text-secondary truncate">{addOn.description}</p>}
                    </div>
                    <a
                      href={addOnWhatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand-primary text-white text-sm font-semibold px-4 py-3 hover:opacity-90 transition-opacity"
                    >
                      Request · {booking!.currency}&nbsp;{addOn.price}{priceLabel}
                    </a>
                  </div>
                );
              })}
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
            <a href={`mailto:${supportEmail}`} className="text-brand-primary font-medium">{supportEmail}</a>.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 hover:bg-brand-primary/5 transition-colors"
          >
            {hasRealHostPhone ? 'Chat with host on WhatsApp' : `Chat with ${brandName} support`}
          </a>
        </div>

        {/* Add to Calendar (TASK-333) */}
        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Add to your calendar</h2>
            <p className="text-sm text-text-secondary">Save your check-in date and property details to your phone calendar.</p>
            <button
              type="button"
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
            {isIosNonPwa ? (
              <p className="text-sm text-text-secondary">
                To receive trip alerts on iPhone, add {getTenantBrandName()} to your home screen first: Safari → Share (
                <span aria-hidden>⎙</span>) → Add to Home Screen. Then re-open from the home screen icon.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={subscribePush}
                  disabled={pushState === "loading" || !supportsPush}
                  className="inline-flex items-center justify-center rounded-lg border border-brand-primary text-brand-primary text-sm font-medium px-4 py-3 disabled:opacity-50"
                >
                  {pushState === "loading" ? "Enabling..." : "Enable notifications"}
                </button>
                {pushMessage ? <p className={`text-xs ${pushState === "error" ? "text-red-600" : "text-green-700"}`}>{pushMessage}</p> : null}
                {pushState === "error" && (pushMessage.includes("denied") || pushMessage.includes("not supported") || pushMessage.includes("not configured")) && (
                  <p className="text-xs text-text-muted mt-1">
                    Try a different browser (Chrome or Firefox) if notifications are blocked.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {canRequestModification && modRequests.length > 0 && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3" data-testid="mod-requests-history">
            <h2 className="text-sm font-semibold text-text-primary">Change requests</h2>
            <ul className="space-y-2">
              {modRequests.map((r) => {
                const isPending = r.status === "Pending";
                const isApproved = r.status === "Approved";
                const badgeClass = isPending
                  ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                  : isApproved
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-gray-100 text-gray-600 border-gray-300";
                const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <li key={r.id} className="rounded-lg border border-border-subtle p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border ${badgeClass}`} data-testid={`mod-status-${r.id}`}>
                        {r.status}
                      </span>
                      <span className="text-xs text-text-muted">{fmtDate(r.createdAtUtc)}</span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {fmtDate(r.requestedCheckinDateUtc)} – {fmtDate(r.requestedCheckoutDateUtc)}
                      {r.requestedGuestCount ? ` · ${r.requestedGuestCount} guests` : ""}
                    </p>
                    {r.note && <p className="text-xs text-text-muted">Your note: {r.note}</p>}
                    {!isPending && r.decisionNote && (
                      <p className="text-xs text-text-secondary">Host note: {r.decisionNote}</p>
                    )}
                    {!isPending && r.decisionMadeAtUtc && (
                      <p className="text-xs text-text-muted">{r.status} on {fmtDate(r.decisionMadeAtUtc)}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {canRequestModification && (
          <div id="booking-change-request" className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Request booking changes</h2>
            {hasPendingModRequest
              ? <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-200">You have a pending change request. Our team will review it shortly.</p>
              : <p className="text-sm text-text-secondary">Need a different date or guest count? Send a request and we will review it.</p>
            }
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* TASK-959: bump booking-modification inputs to py-3 so they meet the 48px
                  minimum tap target. Text is already text-base (16px) which prevents the
                  iOS Safari auto-zoom on focus. */}
              <label className="text-sm text-text-secondary">
                New check-in
                <input
                  type="date"
                  value={modCheckin}
                  onChange={(e) => setModCheckin(e.target.value)}
                  aria-invalid={Boolean(modCheckinError)}
                  className={`mt-1 w-full rounded-md border px-3 py-3 text-base ${modCheckinError ? "border-support-error" : "border-border-subtle"}`}
                />
                {modCheckinError ? (
                  <p className="mt-1 text-xs text-support-error" role="alert">
                    {modCheckinError}
                  </p>
                ) : null}
              </label>
              <label className="text-sm text-text-secondary">
                New check-out
                <input
                  type="date"
                  value={modCheckout}
                  onChange={(e) => setModCheckout(e.target.value)}
                  aria-invalid={Boolean(modCheckoutError)}
                  className={`mt-1 w-full rounded-md border px-3 py-3 text-base ${modCheckoutError ? "border-support-error" : "border-border-subtle"}`}
                />
                {modCheckoutError ? (
                  <p className="mt-1 text-xs text-support-error" role="alert">
                    {modCheckoutError}
                  </p>
                ) : null}
              </label>
              <label className="text-sm text-text-secondary sm:col-span-2">
                Guest count (optional)
                <input type="number" min={1} value={modGuests} onChange={(e) => setModGuests(e.target.value)} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-3 text-base" />
              </label>
              <label className="text-sm text-text-secondary sm:col-span-2">
                Note (optional)
                <textarea value={modNote} onChange={(e) => setModNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border-subtle px-3 py-3 text-base" />
              </label>
            </div>
            <button
              type="button"
              onClick={submitModificationRequest}
              disabled={modSubmitting || modDatesInvalid || hasPendingModRequest}
              className="inline-flex items-center justify-center rounded-lg bg-brand-primary text-white text-sm font-medium px-4 py-3.5 disabled:opacity-50"
              data-testid="mod-request-submit"
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
              Cancellations are subject to our{" "}
              <Link to="/policies#cancellation-refunds" className="font-semibold text-red-900 underline underline-offset-2">
                cancellation &amp; refund policy
              </Link>
              . Submitting a request does not automatically cancel your booking — our team will review it and contact you within 24 hours.
            </p>
            {!showCancelConfirm ? (
              <button
                type="button"
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
                    maxLength={500}
                    placeholder="e.g., change of plans, emergency…"
                    className="mt-1 w-full rounded-md border border-red-200 px-3 py-3 text-base bg-white"
                  />
                  <p className="text-xs text-text-muted">{cancelReason.length}/500</p>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={submitCancellationRequest}
                    disabled={cancelSubmitting}
                    aria-busy={cancelSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white text-base font-medium px-4 py-3 disabled:opacity-50 hover:bg-red-700 transition-colors"
                    data-testid="confirm-cancellation-btn"
                  >
                    {cancelSubmitting && (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                    )}
                    {cancelSubmitting ? "Submitting…" : "Confirm request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-700 text-base font-medium px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {cancelMessage && (
              <p
                role="status"
                aria-live="polite"
                className={`text-base font-medium ${cancelMessage.includes("submitted") ? "text-green-700" : "text-red-700"}`}
              >
                {cancelMessage}
              </p>
            )}
          </div>
        )}
        {cancelRequested && (
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-4 text-base text-green-800 space-y-2" role="status" aria-live="polite">
            <p>✅ Cancellation request received. We&apos;ll contact you within 24 hours.</p>
            <Link
              to="/policies#cancellation-refunds"
              className="inline-block text-brand-primary font-medium underline underline-offset-2 text-base py-1"
              data-testid="cancellation-refund-policy-link"
            >
              Read refund policy
            </Link>
          </div>
        )}

        {!isCancelled && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-2">
            <h2 className="text-sm font-semibold text-text-primary">Explore more stays</h2>
            <p className="text-sm text-text-secondary">
              {getTenantBrandName()} across India — same secure checkout.
            </p>
            <Link
              to="/search"
              className="inline-flex text-sm font-medium text-brand-primary underline underline-offset-2"
              data-testid="confirmation-explore-search"
            >
              Browse all homes →
            </Link>
          </div>
        )}

        {/* TASK-1296: Guest referral share via WhatsApp */}
        {!isCancelled && booking.guestReferralCode && (
          <div className="rounded-2xl border border-green-200 bg-green-50/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Give friends ₹500 off</h2>
            <p className="text-sm text-text-secondary">
              Share your code and your friends get ₹500 off their first {brandName} booking.
            </p>
            <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2 w-fit">
              <span className="text-base font-mono font-bold text-text-primary tracking-widest" data-testid="referral-code">
                {booking.guestReferralCode}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-text-muted shrink-0" htmlFor="referral-lang">Share in:</label>
              <select
                id="referral-lang"
                value={shareLanguage}
                onChange={(e) => setShareLanguage(e.target.value as "en" | "hi" | "te")}
                className="rounded-lg border border-border-subtle bg-bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="te">తెలుగు</option>
              </select>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                shareLanguage === "hi"
                  ? `मैंने ${booking.propertyName} में अपना प्रवास बेहद पसंद किया! 🏠✨ ${brandName} पर बुक करें और कोड ${booking.guestReferralCode} से ₹500 की छूट पाएं: ${window.location.origin}/search`
                  : shareLanguage === "te"
                  ? `${booking.propertyName}లో నా స్టే చాలా బాగుంది! 🏠✨ ${brandName} లో బుక్ చేసుకోండి మరియు ${booking.guestReferralCode} కోడ్ ఉపయోగించి ₹500 డిస్కౌంట్ పొందండి: ${window.location.origin}/search`
                  : `I loved my stay at ${booking.propertyName}! 🏠✨ Book via ${brandName} and use code ${booking.guestReferralCode} for ₹500 off your first booking: ${window.location.origin}/search`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="referral-share-whatsapp"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#25D366] text-white text-base font-medium px-5 py-3 hover:opacity-95 transition-opacity"
            >
              Share on WhatsApp
            </a>
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
          {token && (
            <Link
              to={`/preferences/${encodeURIComponent(token)}`}
              className="text-sm text-brand-primary underline underline-offset-2 hover:text-brand-primary/80"
              data-testid="confirmation-manage-preferences"
            >
              Manage email &amp; WhatsApp preferences
            </Link>
          )}
          <Link
            to="/"
            data-testid="confirmation-cta"
            className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            ← Back to {brandName}
          </Link>
        </div>
      </div>
    </>
  );
}
