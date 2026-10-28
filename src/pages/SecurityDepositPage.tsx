import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { fetchListingById } from "../api/listingClient";
import {
  createPublicDepositOrder,
  DepositRequestError,
  verifyPublicDeposit,
  type DepositVerifyPayload,
  type PublicDepositOrder,
} from "../api/securityDepositClient";
import SEO from "../components/SEO";

/**
 * TASK-10299239: the guest's security-deposit page, reached from the pre-arrival message (or the booking link) at
 * `/booking/:bookingId/deposit?t=<booking-link token>`.
 *
 * It shows the stay and the deposit amount, then places a REFUNDABLE AUTHORIZATION HOLD on the guest's card through the two public
 * atlas-api endpoints (`public-order`, then `public-verify` after Razorpay Checkout). A hold is not a charge: the order is created
 * auth-only (`payment_capture: 0`) and only the host can later capture part of it for a damage claim. The amount is the listing's
 * configured deposit; this page never lets the guest choose or change it.
 *
 * Checkout is limited to cards, because only a card can be held; a UPI or netbanking payment would be taken at once.
 */

interface StaySummary {
  bookingId: number;
  listingId?: number;
  guestName?: string;
  guestPhone?: string;
  propertyName?: string;
  listingName?: string;
  checkinDate?: string;
  checkoutDate?: string;
  status?: string;
}

type Phase = "loading" | "ready" | "starting" | "paying" | "verifying" | "done" | "unavailable";

const LIVE_STATUSES = new Set(["confirmed", "checkedin"]);

const formatInr = (amountInr: number): string =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amountInr)}`;

function loadRazorpayScript(onSuccess: () => void, onError: (message: string) => void): void {
  if (window.Razorpay) {
    onSuccess();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  script.onload = () => (window.Razorpay ? onSuccess() : onError("Razorpay SDK loaded but failed to initialize."));
  script.onerror = () => onError("Failed to load the secure payment window. Please check your connection and try again.");
  document.head.appendChild(script);
}

const readListingNumber = (listing: Record<string, unknown>, key: string): number | null => {
  const raw = listing[key] ?? listing[key.charAt(0).toUpperCase() + key.slice(1)];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};

const readListingString = (listing: Record<string, unknown>, key: string): string | null => {
  const raw = listing[key] ?? listing[key.charAt(0).toUpperCase() + key.slice(1)];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

export default function SecurityDepositPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("t") ?? "").trim();

  const [phase, setPhase] = useState<Phase>("loading");
  const [stay, setStay] = useState<StaySummary | null>(null);
  const [depositInr, setDepositInr] = useState<number | null>(null);
  const [heldInr, setHeldInr] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const bookingPath = bookingId && token ? `/booking/${encodeURIComponent(bookingId)}?t=${encodeURIComponent(token)}` : "/";

  // 1) The stay (the booking-link summary) and, best effort, the configured deposit amount to show before the guest pays.
  useEffect(() => {
    if (!bookingId || !token) {
      setError("Invalid deposit link. Please use the link from your booking message.");
      setPhase("unavailable");
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/guest/bookings/${encodeURIComponent(bookingId)}/summary?t=${encodeURIComponent(token)}`), {
          headers: { Accept: "application/json", ...getApiHeaders() },
          signal: controller.signal,
        });
        if (!res.ok) {
          setError(
            res.status === 404
              ? "We couldn't find this booking. Please use the link from your booking message."
              : "We couldn't load your booking. Please try again.",
          );
          setPhase("unavailable");
          return;
        }
        const summary = (await res.json()) as StaySummary;
        setStay(summary);

        if (!LIVE_STATUSES.has(String(summary.status ?? "").toLowerCase())) {
          setError("This booking is not active, so a security deposit cannot be placed on it.");
          setPhase("unavailable");
          return;
        }

        let amount: number | null = null;
        let method: string | null = null;
        if (summary.listingId) {
          try {
            const listing = (await fetchListingById(summary.listingId, controller.signal)) as Record<string, unknown>;
            amount = readListingNumber(listing, "securityDepositAmount");
            method = readListingString(listing, "securityDepositCollectionMethod");
          } catch {
            // The amount is shown for information; the API stays the authority and answers at Pay.
          }
        }
        if (amount !== null && amount <= 0) {
          setError("No security deposit is needed for this stay.");
          setPhase("unavailable");
          return;
        }
        if (method !== null && method.toLowerCase() !== "online") {
          setError("Your host collects the security deposit in person, so there is nothing to pay here.");
          setPhase("unavailable");
          return;
        }
        setDepositInr(amount);
        setPhase("ready");
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError("Something went wrong loading your booking. Please try again.");
        setPhase("unavailable");
      }
    })();
    return () => controller.abort();
  }, [bookingId, token]);

  // After success the Pay button is gone: move focus to the confirmation so a screen reader announces it.
  useEffect(() => {
    if (phase === "done") doneRef.current?.focus();
  }, [phase]);

  const finishFromFailure = useCallback((e: unknown) => {
    if (e instanceof DepositRequestError) {
      if (e.kind === "already-held") {
        setNotice("Your security deposit hold is already in place. There is nothing more to do.");
        setError(null);
        setPhase("done");
        return;
      }
      if (e.kind === "invalid-link") {
        setError("We couldn't verify this link. Please use the link from your booking message.");
        setPhase("unavailable");
        return;
      }
      if (e.kind === "not-active") {
        setError("This booking is not active, so a security deposit cannot be placed on it.");
        setPhase("unavailable");
        return;
      }
      if (e.kind === "not-offered") {
        setError("No online security deposit is set up for this stay. Please check with your host.");
        setPhase("unavailable");
        return;
      }
    }
    setError("We couldn't complete the deposit hold. You have not been charged. Please try again.");
    setPhase("ready");
  }, []);

  // 2) Verify what Razorpay Checkout returned; the hold becomes Authorized only if the signature checks out.
  const verify = useCallback(
    async (payload: DepositVerifyPayload) => {
      if (!bookingId) return;
      setPhase("verifying");
      try {
        const status = await verifyPublicDeposit(bookingId, token, payload);
        if (status.status.toLowerCase() === "authorized") {
          if (status.amountInr > 0) setHeldInr(status.amountInr);
          setNotice(null);
          setError(null);
          setPhase("done");
          return;
        }
        setError("The deposit hold was not confirmed. You have not been charged. Please try again.");
        setPhase("ready");
      } catch (e) {
        finishFromFailure(e);
      }
    },
    [bookingId, token, finishFromFailure],
  );

  const openCheckout = useCallback(
    (order: PublicDepositOrder) => {
      loadRazorpayScript(
        () => {
          const checkout = new window.Razorpay({
            key: order.razorpayKeyId,
            order_id: order.razorpayOrderId,
            amount: order.amountPaise,
            currency: order.currency || "INR",
            name: stay?.propertyName ?? "Security deposit",
            description: "Refundable security deposit hold (not a charge)",
            prefill: { name: stay?.guestName ?? "", contact: stay?.guestPhone ?? "" },
            // Only a card can be HELD; any other method would be captured immediately.
            method: { card: true, upi: false, netbanking: false, wallet: false, emi: false, paylater: false },
            handler: (response: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }) => {
              void verify({
                depositHoldId: order.depositHoldId,
                razorpayOrderId: response.razorpay_order_id ?? order.razorpayOrderId,
                razorpayPaymentId: response.razorpay_payment_id ?? "",
                razorpaySignature: response.razorpay_signature ?? "",
              });
            },
            modal: {
              ondismiss: () => {
                setNotice("The payment window was closed. You have not been charged.");
                setPhase("ready");
              },
            },
          });
          checkout.on("payment.failed", () => {
            setError("The card could not be held. You have not been charged. Please try another card.");
            setPhase("ready");
          });
          setPhase("paying");
          checkout.open();
        },
        (message) => {
          setError(message);
          setPhase("ready");
        },
      );
    },
    [stay, verify],
  );

  // 3) Pay: create the auth-only order (the amount comes from the listing, server side), then open Checkout.
  const handlePay = async () => {
    if (!bookingId || !token) return;
    setError(null);
    setNotice(null);
    setPhase("starting");
    try {
      const order = await createPublicDepositOrder(bookingId, token);
      setDepositInr(order.amountPaise / 100);
      openCheckout(order);
    } catch (e) {
      finishFromFailure(e);
    }
  };

  const busy = phase === "starting" || phase === "paying" || phase === "verifying";

  return (
    <div className="min-h-screen bg-bg-page px-4 py-10" data-testid="security-deposit-page">
      <SEO title="Security deposit" robots="noindex, nofollow" />
      <div className="mx-auto max-w-lg">
        <p className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-text-muted">Security deposit</p>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
          {phase === "loading" && <p className="text-sm text-text-secondary">Loading your booking…</p>}

          {error && (
            <p role="alert" data-testid="deposit-error" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {notice && phase !== "done" && (
            <p role="status" data-testid="deposit-notice" className="mb-4 rounded-lg border border-border-subtle bg-bg-page px-4 py-3 text-sm text-text-secondary">
              {notice}
            </p>
          )}

          {stay && phase !== "loading" && (
            <div className="mb-5" data-testid="deposit-stay">
              <h1 className="text-xl font-bold text-text-primary">{stay.propertyName ?? "Your stay"}</h1>
              <p className="text-sm text-text-secondary">
                {[stay.listingName, stay.checkinDate && stay.checkoutDate ? `${stay.checkinDate} to ${stay.checkoutDate}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          )}

          {(phase === "ready" || busy) && (
            <>
              <div className="mb-5 rounded-lg border border-border-subtle bg-bg-page p-4 text-sm text-text-primary">
                <p className="font-semibold">
                  Refundable deposit hold
                  {depositInr !== null && depositInr > 0 ? (
                    <span data-testid="deposit-amount">: {formatInr(depositInr)}</span>
                  ) : null}
                </p>
                <p className="mt-2 text-text-secondary">
                  This is a hold on your card, not a charge. Nothing is taken from you unless your host files a damage claim after
                  check-out, and then only up to the amount held. The rest is released.
                </p>
                <p className="mt-2 text-text-secondary">Only a credit or debit card can be used, because only a card can be held.</p>
              </div>
              <button
                type="button"
                data-testid="deposit-pay"
                onClick={handlePay}
                disabled={busy}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {phase === "starting" ? "Preparing…" : phase === "paying" ? "Waiting for the payment window…" : phase === "verifying" ? "Confirming…" : "Hold the deposit on my card"}
              </button>
            </>
          )}

          {phase === "done" && (
            <div
              ref={doneRef}
              role="status"
              tabIndex={-1}
              data-testid="deposit-done"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 outline-none"
            >
              {notice ?? (
                <>
                  ✓ Your security deposit hold{heldInr !== null ? ` of ${formatInr(heldInr)}` : ""} is in place. It is a hold, not a charge,
                  and it is released after check-out unless your host files a damage claim.
                </>
              )}
            </div>
          )}

          {bookingId && token && (
            <p className="mt-5 text-center text-sm">
              <Link to={bookingPath} className="text-brand underline">
                Back to my booking
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
