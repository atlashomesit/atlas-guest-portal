import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import SEO from "../components/SEO";

interface HouseRulesData {
  bookingRef: string;
  listingName: string;
  houseRulesText: string;
  houseRulesPdfUrl: string | null;
  alreadyAccepted: boolean;
  acceptedAtUtc: string | null;
  bookingStatus?: string;
  outcome?: string;
}

function normalizeOutcome(raw: HouseRulesData): "pending" | "confirmed" | "declined" {
  const o = (raw.outcome ?? "").toLowerCase();
  if (o === "confirmed" || o === "declined" || o === "pending") return o;
  const status = (raw.bookingStatus ?? "").toLowerCase();
  if (status === "lead") return "pending";
  if (status === "confirmed" || status === "checkedin" || status === "checkedout") return "confirmed";
  if (status === "cancelled" || status === "expired" || status === "noshow") return "declined";
  return "pending";
}

export default function HouseRulesAcceptPage() {
  const { bookingRef } = useParams<{ bookingRef: string }>();
  const [searchParams] = useSearchParams();
  const lastName = searchParams.get("lastName") ?? "";

  const [data, setData] = useState<HouseRulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  // TASK-10174 a11y half: focus target for the acceptance confirmation banner below, so a
  // screen-reader guest whose focus was on the (now-unmounted) Accept button lands somewhere
  // meaningful instead of falling back to <body>.
  const acceptedConfirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bookingRef || !lastName) {
      setError("This link is missing information. Please use the link from your booking email.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const url = buildApiUrl(
          `/api/public/checkin/${encodeURIComponent(bookingRef)}/house-rules?lastName=${encodeURIComponent(lastName)}`,
        );
        const res = await fetch(url, { headers: getApiHeaders() });
        if (!res.ok) {
          setError("We couldn't find this booking. Please check the link from your booking email.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Something went wrong loading your booking. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingRef, lastName]);

  const handleAccept = async () => {
    if (!bookingRef) return;
    setAccepting(true);
    setError(null);
    try {
      const url = buildApiUrl(`/api/public/checkin/${encodeURIComponent(bookingRef)}/accept-house-rules`);
      const res = await fetch(url, {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ lastName }),
      });
      if (res.status === 409) {
        setError("This booking is no longer awaiting host approval, so House Rules cannot be accepted.");
        return;
      }
      if (!res.ok) {
        setError("We couldn't record your acceptance. Please try again.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const outcome = data ? normalizeOutcome(data) : "pending";
  const pending = outcome === "pending";
  const showAcceptedConfirmation = pending && Boolean(data?.alreadyAccepted);

  // TASK-10174 a11y half: WCAG 4.1.3/2.4.3 -- the "I Accept" button unmounts the instant
  // acceptance succeeds (replaced by the confirmation banner below), so move focus to the
  // banner rather than letting it fall to <body> with nothing announced.
  useEffect(() => {
    if (showAcceptedConfirmation) acceptedConfirmationRef.current?.focus();
  }, [showAcceptedConfirmation]);

  return (
    <div className="min-h-screen bg-bg-page px-4 py-10">
      <SEO title="House Rules" />
      <div className="mx-auto max-w-lg">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-6">
          Confirm your stay
        </p>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
          {loading && <p className="text-text-secondary text-sm">Loading your booking…</p>}

          {!loading && error && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
              {error}
            </p>
          )}

          {/* TASK-10174: this used to be gated on `!error` too, so a FAILED accept attempt
              (handleAccept sets `error` but never clears `data`) unmounted the house-rules
              text and the Accept button entirely, leaving only the alert above with no way
              back except a full page reload -- on a link a guest reached from an OTA email.
              Gating on `data` alone lets the error alert and the still-usable rules/button
              render together, so the SAME "I Accept the House Rules" button that just failed
              is still there as the retry control. */}
          {!loading && data && (
            <>
              <h1 className="text-2xl font-bold text-text-primary mb-1">House Rules</h1>
              <p className="text-text-secondary text-sm mb-6">{data.listingName}</p>

              {outcome === "declined" && (
                <div
                  data-testid="house-rules-outcome-declined"
                  className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3"
                >
                  This request was declined. Your host is not confirming this stay.
                </div>
              )}

              {outcome === "confirmed" && (
                <div
                  data-testid="house-rules-outcome-confirmed"
                  className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3"
                >
                  Your stay is confirmed. Thank you for reviewing the House Rules.
                </div>
              )}

              {showAcceptedConfirmation && (
                <div
                  ref={acceptedConfirmationRef}
                  role="status"
                  tabIndex={-1}
                  className="rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 outline-none"
                >
                  ✓ You&apos;ve accepted the House Rules. Your host has been notified and will confirm your
                  booking shortly.
                </div>
              )}

              {pending && !data.alreadyAccepted && (
                <>
                  <div className="rounded-lg border border-border-subtle bg-bg-page p-4 mb-6 whitespace-pre-wrap text-sm text-text-primary">
                    {data.houseRulesText || "No specific house rules have been provided for this property."}
                  </div>
                  {data.houseRulesPdfUrl && (
                    <a
                      href={data.houseRulesPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-brand underline mb-6"
                    >
                      View full house rules document
                    </a>
                  )}
                  <button
                    type="button"
                    data-testid="house-rules-accept"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full rounded-lg bg-brand text-white font-semibold py-3 text-sm disabled:opacity-60"
                  >
                    {accepting ? "Submitting…" : "I Accept the House Rules"}
                  </button>
                  <p className="text-xs text-text-muted mt-3 text-center">
                    Your host will be notified as soon as you accept, and will confirm your booking shortly after.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
