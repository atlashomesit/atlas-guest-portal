import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { UpiPaymentPanel } from '../components/checkout/UpiPaymentPanel';
import {
  createPayLinkOrder,
  getPayLink,
  PayLinkError,
  verifyPayLinkPayment,
  type PayLinkOrder,
  type PayLinkSummary,
  type RazorpayCheckoutResult,
} from '../api/payLink';
import { openPayLinkCheckout, PayLinkCheckoutError } from '../utils/payLinkCheckout';
import { reportUpiPaid } from '../api/payment';
import { isUpiProvider, type UpiOrder } from '../utils/upiCheckout';

/**
 * PAY-016: the first-party pay page a host shares as `/pay/:token` (walk-in payment, deposit, balance). It shows the stay, the host and the amount, then:
 *  - UPI host (UPI_QR / UPI_DEEPLINK): the one-tap UPI intent + QR, and "I have paid" (tells the host; the booking stays unpaid until the host confirms),
 *  - Razorpay host: "Pay securely" opens Razorpay Checkout IN this page for the order the API created for exactly this amount; what Checkout returns goes to the
 *    API, which verifies the signature and the captured payment before anything is marked paid, and then the guest lands on the booking confirmation. Any refusal
 *    leaves the booking unpaid with a plain sentence. Razorpay's own hosted link is only the fallback when the checkout window cannot open.
 * The amount is the API's current balance; this page never computes money.
 */
function formatInr(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

function isMobileViewport(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  } catch {
    return false;
  }
}

function toUpiOrder(o: PayLinkOrder): UpiOrder | null {
  if (!isUpiProvider(o.mode) || !o.upiUri || !o.upiVpa) return null;
  return {
    provider: o.mode.trim().toUpperCase() as UpiOrder['provider'],
    upiUri: o.upiUri,
    upiVpa: o.upiVpa,
    qrCodeUrl: o.qrCodeUrl && o.qrCodeUrl.startsWith('data:image/') ? o.qrCodeUrl : '',
    reference: o.txnRef ?? '',
  };
}

export default function PayLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<PayLinkSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [upi, setUpi] = useState<{ order: UpiOrder; raw: PayLinkOrder } | null>(null);
  const [reporting, setReporting] = useState(false);
  /** Razorpay Checkout returned but the API has not confirmed it yet: kept so "check again" never makes the guest pay twice. */
  const [unconfirmed, setUnconfirmed] = useState<RazorpayCheckoutResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPayLink(token)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'We could not load this payment page.');
      });
    return () => { cancelled = true; };
  }, [token]);

  /** Asks the API to verify what Checkout returned; on success opens the booking confirmation. Never throws. */
  const confirmPayment = useCallback(
    async (result: RazorpayCheckoutResult, bookingId: number): Promise<void> => {
      try {
        const verified = await verifyPayLinkPayment(token, result);
        setUnconfirmed(null);
        const id = verified.bookingId || bookingId;
        const t = verified.bookingToken;
        navigate(t ? `/booking/${id}?t=${encodeURIComponent(t)}` : `/booking/${id}`, { replace: true });
      } catch (e) {
        setUnconfirmed(result);
        setActionError(e instanceof Error ? e.message : 'We could not confirm your payment, so it is not marked paid. If money was taken, do not pay again - contact your host.');
      }
    },
    [token, navigate],
  );

  const startPayment = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const order = await createPayLinkOrder(token);
      const upiOrder = toUpiOrder(order);
      if (upiOrder) {
        setUpi({ order: upiOrder, raw: order });
      } else if (order.razorpayOrderId && order.razorpayKeyId && typeof order.amountPaise === 'number' && order.amountPaise > 0) {
        // In-page Razorpay Checkout for the server-created order.
        const hostName = summary?.hostName || summary?.propertyName || 'Your stay';
        let result: RazorpayCheckoutResult;
        try {
          result = await openPayLinkCheckout(
            { keyId: order.razorpayKeyId, orderId: order.razorpayOrderId, amountPaise: order.amountPaise },
            hostName,
            `Booking #${order.bookingId}`,
          );
        } catch (e) {
          if (e instanceof PayLinkCheckoutError && e.code === 'UNAVAILABLE' && order.paymentUrl) {
            window.location.assign(order.paymentUrl); // the checkout window cannot open here: Razorpay's hosted link still works
            return;
          }
          setActionError(e instanceof Error ? e.message : 'The payment did not go through. You have not been charged. Please try again.');
          return;
        }
        await confirmPayment(result, order.bookingId);
      } else if (order.paymentUrl) {
        window.location.assign(order.paymentUrl);
      } else {
        setActionError('We could not start the payment. Please contact the host.');
      }
    } catch (e) {
      setActionError(e instanceof PayLinkError || e instanceof Error ? e.message : 'We could not start the payment. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [token, summary, confirmPayment]);

  const checkAgain = useCallback(async () => {
    if (!unconfirmed) return;
    setChecking(true);
    setActionError(null);
    try {
      await confirmPayment(unconfirmed, summary?.bookingId ?? 0);
    } finally {
      setChecking(false);
    }
  }, [unconfirmed, summary, confirmPayment]);

  const iHavePaid = useCallback(async () => {
    if (!upi) return;
    setReporting(true);
    setActionError(null);
    try {
      await reportUpiPaid(upi.raw.bookingId, upi.raw.bookingToken ?? null);
      const t = upi.raw.bookingToken;
      navigate(t ? `/booking/${upi.raw.bookingId}?t=${encodeURIComponent(t)}` : `/booking/${upi.raw.bookingId}`, { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not tell the host. Please try again.');
    } finally {
      setReporting(false);
    }
  }, [upi, navigate]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8" data-testid="pay-link-page">
      <SEO title="Pay for your stay" description="Pay for your stay securely." robots="noindex, nofollow" />
      {!summary && !loadError && <p className="text-stone-600" data-testid="pay-link-loading">Loading your payment…</p>}

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert" data-testid="pay-link-error">
          {loadError}
        </div>
      )}

      {summary && (
        <>
          <header className="mb-4">
            <h1 className="text-xl font-semibold text-stone-900" data-testid="pay-link-title">
              {summary.guestFirstName ? `Hi ${summary.guestFirstName}, ` : ''}pay for your stay at {summary.hostName || summary.propertyName}
            </h1>
          </header>

          <section className="mb-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800" data-testid="pay-link-summary">
            <p className="font-medium">{[summary.propertyName, summary.listingName].filter(Boolean).join(' - ')}</p>
            <p className="mt-1 text-stone-600">
              {summary.checkIn} to {summary.checkOut} ({summary.nights} {summary.nights === 1 ? 'night' : 'nights'})
            </p>
            <p className="mt-2 text-base font-semibold" data-testid="pay-link-amount">
              {summary.alreadyPaid ? 'Nothing left to pay' : `Amount to pay: ${formatInr(summary.amountDueInr, summary.currency)}`}
            </p>
          </section>

          {summary.alreadyPaid && (
            <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900" data-testid="pay-link-paid">
              This stay is paid up. Thank you!
            </p>
          )}

          {!summary.alreadyPaid && summary.mode === 'UNAVAILABLE' && (
            <p className="rounded-xl bg-amber-50 p-4 text-amber-900" data-testid="pay-link-unavailable">
              Online payment is not available for this property right now. Please contact your host to pay.
            </p>
          )}

          {!summary.alreadyPaid && summary.mode === 'RAZORPAY' && !unconfirmed && (
            <button
              type="button"
              onClick={() => void startPayment()}
              disabled={busy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              data-testid="pay-link-razorpay-pay"
            >
              {busy ? 'Opening secure checkout…' : `Pay ${formatInr(summary.amountDueInr, summary.currency)} securely`}
            </button>
          )}

          {!summary.alreadyPaid && isUpiProvider(summary.mode) && !upi && (
            <button
              type="button"
              onClick={() => void startPayment()}
              disabled={busy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              data-testid="pay-link-upi-start"
            >
              {busy ? 'Getting your UPI payment ready…' : `Pay ${formatInr(summary.amountDueInr, summary.currency)} with UPI`}
            </button>
          )}

          {upi && (
            <UpiPaymentPanel
              order={upi.order}
              amountInr={upi.raw.amountInr}
              payeeName={upi.raw.payeeName ?? summary.payeeName}
              countdown={null}
              holdActive={false}
              showHold={false}
              isMobile={isMobileViewport()}
              onIHavePaid={() => void iHavePaid()}
              busy={reporting}
              error={actionError}
            />
          )}

          {unconfirmed && (
            <button
              type="button"
              onClick={() => void checkAgain()}
              disabled={checking}
              className="mt-3 w-full rounded-lg border border-emerald-700 px-4 py-3 text-base font-semibold text-emerald-800 disabled:opacity-60"
              data-testid="pay-link-check-again"
            >
              {checking ? 'Checking your payment…' : 'Check my payment again'}
            </button>
          )}

          {actionError && !upi && (
            <p className="mt-3 text-sm text-red-700" role="alert" data-testid="pay-link-action-error">{actionError}</p>
          )}
        </>
      )}
    </main>
  );
}
