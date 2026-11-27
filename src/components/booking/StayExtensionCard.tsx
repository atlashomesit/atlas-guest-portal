import React, { useState } from "react";
import { buildApiUrl } from "../../api/client";
import { formatCurrency } from "../../utils/formatting";

export interface ExtendQuoteResponse {
  available: boolean;
  extraNights?: number;
  extraTotalAmount?: number;
  totalDifference?: number;
  subtotal?: number;
  taxAmount?: number;
  currency?: string;
  unavailableReason?: string;
  message?: string;
}

export interface ExtendOrderResponse {
  orderId?: string;
  keyId?: string;
  amountPaise?: number;
  amount?: number;
  currency?: string;
  upiDeeplink?: string;
  paymentUrl?: string;
  extended?: boolean;
  newCheckoutDate?: string;
  newTotalAmount?: number;
  message?: string;
}

interface StayExtensionCardProps {
  bookingId: number;
  token: string;
  currentCheckoutDateIso?: string;
  currentCheckoutDisplay: string;
  currency: string;
  guestName: string;
  guestPhone?: string;
  propertyName: string;
  onExtended?: (newCheckoutDateIso: string, newTotalAmount?: number) => void;
}

function addDaysIso(isoDate: string, days: number): string {
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return dt.toISOString().slice(0, 10);
}

export const StayExtensionCard: React.FC<StayExtensionCardProps> = ({
  bookingId,
  token,
  currentCheckoutDateIso,
  currentCheckoutDisplay,
  currency,
  guestName,
  guestPhone,
  propertyName,
  onExtended,
}) => {
  const [open, setOpen] = useState(false);
  const [newCheckoutDate, setNewCheckoutDate] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<ExtendQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [upiLink, setUpiLink] = useState<string | null>(null);
  const [extendedMessage, setExtendedMessage] = useState<string | null>(null);

  const minDate = currentCheckoutDateIso ? addDaysIso(currentCheckoutDateIso, 1) : undefined;

  async function handleDateChange(nextDate: string) {
    setNewCheckoutDate(nextDate);
    setQuote(null);
    setQuoteError(null);
    setPayError(null);
    setUpiLink(null);
    setExtendedMessage(null);

    if (!nextDate) return;
    if (currentCheckoutDateIso && nextDate <= currentCheckoutDateIso.slice(0, 10)) {
      setQuoteError("Please choose a checkout date after your current checkout.");
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await fetch(
        buildApiUrl(
          `/api/public/bookings/${bookingId}/extend-quote?newCheckoutDate=${encodeURIComponent(nextDate)}&t=${encodeURIComponent(token)}`
        )
      );
      if (res.status === 404 || res.status === 501) {
        setQuoteError(
          "Instant online extension is not available for this stay yet. Use 'Need different dates?' below to message your host."
        );
        return;
      }
      const data = (await res.json().catch(() => null)) as ExtendQuoteResponse | null;
      if (res.status === 409) {
        setQuote({
          available: false,
          unavailableReason:
            data?.unavailableReason ||
            data?.message ||
            "Those extra nights are not available on this unit. Try an earlier checkout date or message your host.",
        });
        return;
      }
      if (!res.ok || !data) {
        setQuoteError(data?.message || "Could not check availability right now. Please try again.");
        return;
      }
      setQuote(data);
    } catch {
      setQuoteError("Network error while checking extension availability. Please try again.");
    } finally {
      setQuoteLoading(false);
    }
  }

  const extraAmount = quote?.extraTotalAmount ?? quote?.totalDifference ?? 0;
  const quoteCurrency = quote?.currency || currency || "INR";

  async function handlePayToExtend() {
    if (!newCheckoutDate || !quote?.available || paying) return;
    setPaying(true);
    setPayError(null);
    setUpiLink(null);

    try {
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${bookingId}/extend-order?t=${encodeURIComponent(token)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newCheckoutDate }),
        }
      );
      const data = (await res.json().catch(() => null)) as ExtendOrderResponse | null;
      if (!res.ok || !data) {
        setPayError(data?.message || "Could not start extension payment. Please try again.");
        return;
      }

      if (data.extended) {
        setExtendedMessage(`Your stay has been extended to ${newCheckoutDate}.`);
        onExtended?.(newCheckoutDate, data.newTotalAmount);
        return;
      }

      const RazorpayCtor = (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } })
        .Razorpay;

      if (RazorpayCtor && data.orderId && data.keyId) {
        const rzp = new RazorpayCtor({
          key: data.keyId,
          order_id: data.orderId,
          amount: data.amountPaise ?? Math.round(extraAmount * 100),
          currency: data.currency || quoteCurrency,
          name: propertyName,
          description: `Extend stay to ${newCheckoutDate}`,
          prefill: {
            name: guestName,
            contact: guestPhone || "",
          },
          method: { upi: true, card: true, netbanking: true },
          handler: async (response: Record<string, string>) => {
            try {
              const verifyRes = await fetch(
                buildApiUrl(`/api/public/bookings/${bookingId}/extend-verify?t=${encodeURIComponent(token)}`),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    newCheckoutDate,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                }
              );
              if (verifyRes.ok) {
                const verified = (await verifyRes.json().catch(() => null)) as { newTotalAmount?: number } | null;
                setExtendedMessage(`Payment confirmed! Your stay is now extended to ${newCheckoutDate}.`);
                onExtended?.(newCheckoutDate, verified?.newTotalAmount);
              } else {
                setPayError("Payment received — we are confirming your extension. Refresh in a moment.");
              }
            } catch {
              setPayError("Payment received — please refresh to see your updated checkout date.");
            }
          },
        });
        rzp.open();
        return;
      }

      if (data.upiDeeplink) {
        setUpiLink(data.upiDeeplink);
        return;
      }

      if (data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }

      setPayError("Payment gateway is not loaded on this page. Please refresh and try again.");
    } catch {
      setPayError("Network error while starting payment. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="pt-3" data-testid="extend-stay-card">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-primary/40 bg-brand-primary/5 px-3.5 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10 transition-colors"
        data-testid="extend-stay-trigger"
        aria-expanded={open}
      >
        <span>Extend your stay</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="mt-3 rounded-xl border border-border-subtle bg-bg-page p-4 space-y-3"
          data-testid="extend-stay-drawer"
        >
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Add extra nights instantly</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Current check-out: <span className="font-medium text-text-primary">{currentCheckoutDisplay}</span>. Pick a later date to see the live all-in price difference and pay online via UPI.
            </p>
          </div>

          <label className="block text-xs font-medium text-text-secondary">
            New check-out date
            <input
              type="date"
              min={minDate}
              value={newCheckoutDate}
              onChange={(e) => handleDateChange(e.target.value)}
              data-testid="extend-stay-date-input"
              className="mt-1 w-full rounded-md border border-border-subtle bg-bg-surface px-3 py-2.5 text-base text-text-primary"
            />
          </label>

          {quoteLoading && (
            <p className="text-xs text-text-secondary" data-testid="extend-stay-loading">
              Checking availability &amp; live price…
            </p>
          )}

          {quoteError && (
            <p className="text-xs text-support-error" role="alert" data-testid="extend-stay-error">
              {quoteError}
            </p>
          )}

          {quote && !quote.available && (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              role="status"
              data-testid="extend-stay-unavailable"
            >
              {quote.unavailableReason || quote.message || "Those extra nights are not available."}
            </p>
          )}

          {quote && quote.available && (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2.5"
              data-testid="extend-stay-quote-summary"
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-secondary">
                  {quote.extraNights ? `+${quote.extraNights} extra ${quote.extraNights === 1 ? "night" : "nights"} (all-in)` : "All-in price difference"}
                </span>
                <span className="font-bold text-text-primary" data-testid="extend-stay-price-diff">
                  {formatCurrency(extraAmount, { currency: quoteCurrency })}
                </span>
              </div>

              <button
                type="button"
                onClick={handlePayToExtend}
                disabled={paying || extraAmount <= 0}
                data-testid="extend-stay-pay-btn"
                className="w-full min-h-11 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {paying
                  ? "Starting UPI payment…"
                  : `Pay ${formatCurrency(extraAmount, { currency: quoteCurrency })} to extend`}
              </button>
            </div>
          )}

          {upiLink && (
            <div className="rounded-lg border border-brand-primary/30 bg-bg-surface p-3 space-y-2" data-testid="extend-stay-upi-box">
              <p className="text-xs text-text-secondary">Tap below to complete your instant UPI payment:</p>
              <a
                href={upiLink}
                data-testid="extend-stay-upi-link"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Open UPI app to pay
              </a>
            </div>
          )}

          {payError && (
            <p className="text-xs text-support-error" role="alert" data-testid="extend-stay-pay-error">
              {payError}
            </p>
          )}

          {extendedMessage && (
            <p
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              role="status"
              data-testid="extend-stay-success"
            >
              {extendedMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default StayExtensionCard;
