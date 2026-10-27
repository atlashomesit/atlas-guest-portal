/**
 * PAY-010: "Pay ₹X with UPI" for hosts whose payment provider is UPI_QR / UPI_DEEPLINK.
 *
 * The money goes from the guest's UPI app straight to the host's UPI address. On a phone the main action is the one-tap
 * `upi://pay` link (opens GPay / PhonePe / Paytm); on a computer it is the QR to scan with the phone. The UPI address and
 * a copy button are always shown, with the live hold countdown. "I have paid" only tells the host: the booking stays
 * unpaid until the host confirms the money arrived (HARD RULE 24 fail-safe), and the panel says so.
 */
import React, { useState } from 'react';
import type { UpiOrder } from '@/utils/upiCheckout';

interface Props {
  order: UpiOrder;
  /** What the guest pays, in RUPEES, exactly as the order charged it (website price shown = charged). */
  amountInr: number;
  payeeName?: string | null;
  /** Live countdown for the hold, e.g. "6:42"; null/'0:00' means the hold is over. */
  countdown: string | null;
  holdActive: boolean;
  isMobile: boolean;
  onIHavePaid: () => void;
  busy?: boolean;
  error?: string | null;
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export const UpiPaymentPanel: React.FC<Props> = ({
  order,
  amountInr,
  payeeName,
  countdown,
  holdActive,
  isMobile,
  onIHavePaid,
  busy = false,
  error = null,
}) => {
  const [copied, setCopied] = useState(false);
  const amountLabel = formatInr(amountInr);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(order.upiVpa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const qr = order.qrCodeUrl ? (
    <img
      src={order.qrCodeUrl}
      alt={`UPI QR code to pay ${amountLabel}`}
      className="mx-auto h-48 w-48 rounded-md border border-stone-200 bg-white p-2"
      data-testid="upi-pay-qr"
    />
  ) : null;

  return (
    <section
      className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-stone-900"
      aria-labelledby="upi-pay-title"
      data-testid="upi-pay-panel"
    >
      <h2 id="upi-pay-title" className="text-base font-semibold" data-testid="upi-pay-title">
        Pay {amountLabel} with UPI
      </h2>
      <p className="mt-1 text-stone-700">
        Your payment goes straight to {payeeName ? <b>{payeeName}</b> : 'the host'}. Pay exactly {amountLabel}.
      </p>
      <p className="mt-1 font-medium" data-testid="upi-pay-hold-line" aria-live="polite">
        {holdActive && countdown && countdown !== '0:00'
          ? `Your dates are held for ${countdown}.`
          : 'Your 10 minutes are over. If you already paid, tap "I have paid" so the host can check.'}
      </p>

      {isMobile ? (
        <div className="mt-3">
          <a
            href={order.upiUri}
            className="block w-full rounded-lg bg-emerald-700 px-4 py-3 text-center text-base font-semibold text-white"
            data-testid="upi-pay-open-app"
          >
            Pay {amountLabel} in your UPI app
          </a>
          {qr && (
            <details className="mt-2">
              <summary className="cursor-pointer text-stone-700">Paying from another phone? Show the QR code</summary>
              <div className="mt-2">{qr}</div>
            </details>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {qr}
          <p className="mt-2 text-center text-stone-700">Scan with any UPI app (GPay, PhonePe, Paytm, BHIM).</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-stone-700">UPI ID:</span>
        <code className="rounded bg-white px-2 py-1" data-testid="upi-pay-vpa">{order.upiVpa}</code>
        <button
          type="button"
          onClick={() => void copyAddress()}
          className="rounded-md border border-stone-300 bg-white px-2 py-1"
          data-testid="upi-pay-copy-vpa"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {order.reference && (
        <p className="mt-1 text-stone-600" data-testid="upi-pay-reference">
          Reference: {order.reference}
        </p>
      )}

      <button
        type="button"
        onClick={onIHavePaid}
        disabled={busy}
        className="mt-4 w-full rounded-lg border border-emerald-700 bg-white px-4 py-3 text-base font-semibold text-emerald-800 disabled:opacity-60"
        data-testid="upi-pay-i-have-paid"
      >
        {busy ? 'Telling the host…' : 'I have paid'}
      </button>
      <p className="mt-2 text-xs text-stone-600">
        Your booking is confirmed once the host sees your payment. Only tap this after your UPI app shows the payment as
        successful.
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert" data-testid="upi-pay-error">
          {error}
        </p>
      )}
    </section>
  );
};
