/**
 * Founder ruling 2026-10-19: after the FIRST failed payment the guest sees "Payment didn't go through" with
 * [Try again] and [Message the host on WhatsApp]. The WhatsApp button opens the guest's own WhatsApp to the HOST's
 * number with a pre-written message (room, dates, guests, amount, guest name); the guest only taps Send. With no
 * WhatsApp number it is a call link to the host's phone. Never Atlas's own number: a host with no number at all gets
 * no contact button. The dates are released at the 10-minute mark, so the panel says how long they are still held.
 */
import React from 'react';
import type { HostFailureContactAction } from '@/utils/hostPaymentFailure';

interface Props {
  /** One plain sentence on why, from Razorpay's own answer (e.g. "Your bank did not approve it."). Optional. */
  reasonText?: string | null;
  /** Live countdown for the 10-minute hold, e.g. "6:42"; null/'0:00' means the hold is over. */
  countdown: string | null;
  holdActive: boolean;
  contact: HostFailureContactAction | null;
  onTryAgain: () => void;
  busy?: boolean;
  /** `details` matches the GuestDetailsPage `.gd-*` look; `embed` uses the embed widget's utility classes. */
  variant?: 'details' | 'embed';
}

export const PaymentFailedPanel: React.FC<Props> = ({
  reasonText,
  countdown,
  holdActive,
  contact,
  onTryAgain,
  busy = false,
  variant = 'details',
}) => {
  const isEmbed = variant === 'embed';
  return (
    <div
      className={isEmbed ? 'mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900' : 'gd-banner gd-fail'}
      role="alert"
      data-testid="payment-failed-panel"
    >
      <div>
        <b className={isEmbed ? 'block text-base' : 'gd-fail-title'} data-testid="payment-failed-title">
          Payment didn&apos;t go through
        </b>
        <span className={isEmbed ? 'block' : 'gd-fail-sub'}>
          No money was taken.{reasonText ? ` ${reasonText}` : ''}
        </span>
        <span className={isEmbed ? 'mt-1 block' : 'gd-fail-hold'} data-testid="payment-failed-hold-line">
          {holdActive && countdown && countdown !== '0:00'
            ? `Your dates are still held for ${countdown}.`
            : 'Your 10 minutes are over, so the dates are open again. Tap Try again and we will check them first.'}
        </span>
        <div className={isEmbed ? 'mt-2 flex flex-wrap items-center gap-2' : 'gd-fail-actions'}>
          <button
            type="button"
            onClick={onTryAgain}
            disabled={busy}
            className={isEmbed ? 'rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60' : 'gd-fail-try'}
            data-testid="payment-failed-try-again"
          >
            {busy ? 'Starting…' : 'Try again'}
          </button>
          {contact && (
            <a
              href={contact.href}
              target={contact.kind === 'whatsapp' ? '_blank' : undefined}
              rel={contact.kind === 'whatsapp' ? 'noopener noreferrer' : undefined}
              className={isEmbed ? 'rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-900' : 'gd-fail-host'}
              data-testid={contact.kind === 'whatsapp' ? 'payment-failed-whatsapp-host' : 'payment-failed-call-host'}
            >
              {contact.label}
            </a>
          )}
        </div>
        {contact?.kind === 'whatsapp' && (
          <span className={isEmbed ? 'mt-1 block text-xs' : 'gd-fail-note'}>
            This opens your WhatsApp with the message already written — you only tap Send.
          </span>
        )}
      </div>
    </div>
  );
};

export default PaymentFailedPanel;
