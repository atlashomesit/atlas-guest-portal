import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { UpiPaymentPanel } from '../components/checkout/UpiPaymentPanel';
import { createPayLinkOrder, getPayLink, PayLinkError, type PayLinkOrder, type PayLinkSummary } from '../api/payLink';
import { reportUpiPaid } from '../api/payment';
import { isUpiProvider, type UpiOrder } from '../utils/upiCheckout';

/**
 * PAY-016: the first-party pay page a host shares as `/pay/:token` (walk-in payment, deposit, balance). It shows the stay, the host and the amount, then:
 *  - UPI host (UPI_QR / UPI_DEEPLINK): the one-tap UPI intent + QR, and "I have paid" (tells the host; the booking stays unpaid until the host confirms),
 *  - Razorpay host: "Pay securely" -> Razorpay's checkout for exactly this amount.
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

  useEffect(() => {
    let cancelled = false;
    getPayLink(token)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'We could not load this payment page.');
      });
    return () => { cancelled = true; };
  }, [token]);

  const startPayment = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const order = await createPayLinkOrder(token);
      const upiOrder = toUpiOrder(order);
      if (upiOrder) {
        setUpi({ order: upiOrder, raw: order });
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
  }, [token]);

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

          {!summary.alreadyPaid && summary.mode === 'RAZORPAY' && (
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

          {actionError && !upi && (
            <p className="mt-3 text-sm text-red-700" role="alert" data-testid="pay-link-action-error">{actionError}</p>
          )}
        </>
      )}
    </main>
  );
}
