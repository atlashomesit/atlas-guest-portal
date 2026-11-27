import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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

function formatExpiryCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function isMobileViewport(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  } catch {
    return false;
  }
}

function toUpiOrder(o: PayLinkOrder): UpiOrder | null {
  const isDynamic = Boolean(o.isDynamicQr || o.qrCodeId || o.mode.trim().toUpperCase() === 'RAZORPAY_DYNAMIC_QR');
  if (!isDynamic && (!isUpiProvider(o.mode) || !o.upiUri || !o.upiVpa)) return null;
  const qrUrl = o.qrImageUrl || (o.qrCodeUrl && (o.qrCodeUrl.startsWith('data:image/') || (isDynamic && o.qrCodeUrl.startsWith('https://'))) ? o.qrCodeUrl : '');
  return {
    provider: (isUpiProvider(o.mode) ? o.mode.trim().toUpperCase() : 'RAZORPAY_DYNAMIC_QR') as UpiOrder['provider'],
    upiUri: o.upiUri ?? '',
    upiVpa: o.upiVpa ?? '',
    qrCodeUrl: qrUrl,
    reference: o.txnRef ?? '',
    ...(isDynamic ? { isDynamicQr: true, qrCodeId: o.qrCodeId ?? null, qrImageUrl: o.qrImageUrl ?? null } : {}),
  };
}

export default function PayLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const rawInstalmentId = searchParams.get('instalmentId');
  const parsedInstalmentId = rawInstalmentId ? Number(rawInstalmentId) : null;
  const instalmentId = parsedInstalmentId && Number.isFinite(parsedInstalmentId) && parsedInstalmentId > 0 ? parsedInstalmentId : null;
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
  /** PAY-049: live clock for expiry countdown and editable partial payment amount. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [partialAmountInput, setPartialAmountInput] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    getPayLink(token, instalmentId)
      .then((s) => {
        if (!cancelled) {
          setSummary(s);
          const rem = typeof s.remainingInr === 'number' ? s.remainingInr : s.amountDueInr;
          setPartialAmountInput(String(rem));
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'We could not load this payment page.');
      });
    return () => { cancelled = true; };
  }, [token, instalmentId]);

  useEffect(() => {
    if (!summary?.expiresAtUtc || summary.alreadyPaid || summary.upgradeHoldLapsed) return;
    const expiryMs = Date.parse(summary.expiresAtUtc);
    if (!Number.isFinite(expiryMs)) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [summary?.expiresAtUtc, summary?.alreadyPaid, summary?.upgradeHoldLapsed]);

  const expiryMs = summary?.expiresAtUtc ? Date.parse(summary.expiresAtUtc) : NaN;
  const msUntilExpiry = Number.isFinite(expiryMs) ? expiryMs - nowMs : null;
  const isLinkExpired = Boolean(summary?.isExpired) || (msUntilExpiry !== null && msUntilExpiry <= 0);

  const effectiveRemaining = summary
    ? (typeof summary.remainingInr === 'number' ? summary.remainingInr : summary.amountDueInr)
    : 0;
  const minPartial = summary?.allowPartialPayments
    ? Math.min(effectiveRemaining, Math.max(100, summary.minPartialAmountInr ?? 100))
    : effectiveRemaining;
  const parsedPartial = summary?.allowPartialPayments ? Number(partialAmountInput) : effectiveRemaining;
  const partialValidationError = summary?.allowPartialPayments && !summary.alreadyPaid && !isLinkExpired
    ? (!Number.isFinite(parsedPartial) || parsedPartial <= 0
        ? 'Enter a valid payment amount.'
        : parsedPartial < minPartial
          ? `Minimum partial payment is ${formatInr(minPartial, summary.currency)}.`
          : parsedPartial > effectiveRemaining
            ? `Amount cannot exceed remaining balance (${formatInr(effectiveRemaining, summary.currency)}).`
            : null)
    : null;
  const effectivePayAmount = summary?.allowPartialPayments && !partialValidationError
    ? parsedPartial
    : effectiveRemaining;

  /** Asks the API to verify what Checkout returned; on success opens the booking confirmation. Never throws. */
  const confirmPayment = useCallback(
    async (result: RazorpayCheckoutResult, bookingId: number): Promise<void> => {
      try {
        const verified = await verifyPayLinkPayment(token, result, instalmentId);
        setUnconfirmed(null);
        const id = verified.bookingId || bookingId;
        const t = verified.bookingToken;
        navigate(t ? `/booking/${id}?t=${encodeURIComponent(t)}` : `/booking/${id}`, { replace: true });
      } catch (e) {
        setUnconfirmed(result);
        setActionError(e instanceof Error ? e.message : 'We could not confirm your payment, so it is not marked paid. If money was taken, do not pay again - contact your host.');
      }
    },
    [token, instalmentId, navigate],
  );

  const startPayment = useCallback(async () => {
    if (isLinkExpired || partialValidationError) return;
    setBusy(true);
    setActionError(null);
    try {
      const requestedAmount = summary?.allowPartialPayments ? effectivePayAmount : null;
      const order = await createPayLinkOrder(token, instalmentId, requestedAmount);
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
  }, [token, summary, confirmPayment, instalmentId, isLinkExpired, partialValidationError, effectivePayAmount]);

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

  const pollDynamicQrStatus = useCallback(async (): Promise<'pending' | 'paid' | 'expired'> => {
    const latest = await getPayLink(token, instalmentId);
    if (latest.alreadyPaid) return 'paid';
    if (latest.isExpired) return 'expired';
    return 'pending';
  }, [token, instalmentId]);

  const handleDynamicQrConfirmed = useCallback(() => {
    if (!upi) return;
    const t = upi.raw.bookingToken;
    navigate(t ? `/booking/${upi.raw.bookingId}?t=${encodeURIComponent(t)}` : `/booking/${upi.raw.bookingId}`, { replace: true });
  }, [upi, navigate]);

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
              {summary.upgradeTitle
                ? summary.upgradeTitle
                : `${summary.guestFirstName ? `Hi ${summary.guestFirstName}, ` : ''}pay for your stay at ${summary.hostName || summary.propertyName}`}
            </h1>
          </header>

          {summary.upgradeHoldLapsed ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="pay-link-upgrade-lapsed">
              <p className="font-medium">This upgrade is no longer held for you.</p>
              {summary.checkInReturnUrl && (
                <a
                  href={summary.checkInReturnUrl}
                  className="mt-2 inline-block font-semibold underline"
                  data-testid="pay-link-upgrade-back"
                >
                  Back to your check-in page
                </a>
              )}
            </div>
          ) : null}

          <section className="mb-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800" data-testid="pay-link-summary">
            <p className="font-medium">{[summary.propertyName, summary.listingName].filter(Boolean).join(' - ')}</p>
            <p className="mt-1 text-stone-600">
              {summary.checkIn} to {summary.checkOut} ({summary.nights} {summary.nights === 1 ? 'night' : 'nights'})
            </p>
            <p className="mt-2 text-base font-semibold" data-testid="pay-link-amount">
              {summary.upgradeHoldLapsed
                ? 'Nothing charged'
                : summary.alreadyPaid
                  ? 'Nothing left to pay'
                  : `Amount to pay: ${formatInr(effectiveRemaining, summary.currency)}`}
            </p>

            {!summary.alreadyPaid && !summary.upgradeHoldLapsed && !isLinkExpired && msUntilExpiry !== null && msUntilExpiry > 0 && (
              <p
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                data-testid="pay-link-expiry"
                aria-live="polite"
              >
                <span>Link expires in {formatExpiryCountdown(msUntilExpiry)}</span>
              </p>
            )}

            {((typeof summary.paidSoFarInr === 'number' && summary.paidSoFarInr > 0) ||
              (summary.allowPartialPayments && typeof summary.totalAmountInr === 'number' && summary.totalAmountInr > 0)) && (
              <div className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-700" data-testid="pay-link-partial-progress">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Paid so far: <strong>{formatInr(summary.paidSoFarInr ?? 0, summary.currency)}</strong></span>
                  <span>Remaining: <strong>{formatInr(effectiveRemaining, summary.currency)}</strong></span>
                </div>
                {typeof summary.totalAmountInr === 'number' && summary.totalAmountInr > 0 && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, Math.round(((summary.paidSoFarInr ?? 0) / summary.totalAmountInr) * 100)))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {!summary.alreadyPaid && !summary.upgradeHoldLapsed && isLinkExpired && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="pay-link-expired">
              This payment link has expired. Please ask your host for a new link.
            </div>
          )}

          {summary.allowPartialPayments && !summary.alreadyPaid && !summary.upgradeHoldLapsed && !isLinkExpired && (
            <section className="mb-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800" data-testid="pay-link-partial-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="pay-link-partial-amount" className="font-medium text-stone-900">
                  Choose amount to pay ({summary.currency})
                </label>
                <button
                  type="button"
                  onClick={() => setPartialAmountInput(String(effectiveRemaining))}
                  className="text-xs font-semibold text-emerald-700 underline"
                  data-testid="pay-link-pay-remaining"
                >
                  Pay remaining {formatInr(effectiveRemaining, summary.currency)}
                </button>
              </div>
              <input
                id="pay-link-partial-amount"
                type="number"
                inputMode="decimal"
                min={minPartial}
                max={effectiveRemaining}
                step="any"
                value={partialAmountInput}
                onChange={(e) => setPartialAmountInput(e.target.value)}
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-base text-stone-900 focus:border-emerald-600 focus:outline-none"
                data-testid="pay-link-partial-amount-input"
              />
              <p className="mt-1 text-xs text-stone-600">
                Enter between {formatInr(minPartial, summary.currency)} and {formatInr(effectiveRemaining, summary.currency)}.
              </p>
              {partialValidationError && (
                <p className="mt-1 text-xs font-medium text-red-700" role="alert" data-testid="pay-link-partial-error">
                  {partialValidationError}
                </p>
              )}
            </section>
          )}

          {summary.alreadyPaid && !summary.upgradeHoldLapsed && (
            <p className="rounded-xl bg-emerald-50 p-4 text-emerald-900" data-testid="pay-link-paid">
              This stay is paid up. Thank you!
            </p>
          )}

          {!summary.alreadyPaid && !summary.upgradeHoldLapsed && !isLinkExpired && summary.mode === 'UNAVAILABLE' && (
            <p className="rounded-xl bg-amber-50 p-4 text-amber-900" data-testid="pay-link-unavailable">
              Online payment is not available for this property right now. Please contact your host to pay.
            </p>
          )}

          {!summary.alreadyPaid && !summary.upgradeHoldLapsed && !isLinkExpired && summary.mode === 'RAZORPAY' && !unconfirmed && (
            <button
              type="button"
              onClick={() => void startPayment()}
              disabled={busy || Boolean(partialValidationError)}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              data-testid="pay-link-razorpay-pay"
            >
              {busy ? 'Opening secure checkout…' : `Pay ${formatInr(effectivePayAmount, summary.currency)} securely`}
            </button>
          )}

          {!summary.alreadyPaid && !summary.upgradeHoldLapsed && !isLinkExpired && isUpiProvider(summary.mode) && !upi && (
            <button
              type="button"
              onClick={() => void startPayment()}
              disabled={busy || Boolean(partialValidationError)}
              className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              data-testid="pay-link-upi-start"
            >
              {busy ? 'Getting your UPI payment ready…' : `Pay ${formatInr(effectivePayAmount, summary.currency)} with UPI`}
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
              isDynamicQr={Boolean(upi.order.isDynamicQr)}
              pollStatus={upi.order.isDynamicQr ? pollDynamicQrStatus : undefined}
              onAutoConfirmed={upi.order.isDynamicQr ? handleDynamicQrConfirmed : undefined}
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
