// BookingCardPricingPaymentSection.tsx
import React from 'react';
import { format } from 'date-fns';
import { inlinePolicySnippets } from '../../../content/terms';
import { FaUserFriends, FaCreditCard, FaCcVisa, FaCcMastercard } from 'react-icons/fa';
import { SiGooglepay, SiRazorpay } from 'react-icons/si';

interface NightlyBreakdownItem {
  date: Date;
  breakdown: {
    finalNightlyPrice: number;
    isNewYearsEve?: boolean;
  };
}

interface BookingCardPricingPaymentSectionProps {
  hasSelection: boolean;
  hasInteractedWithDates: boolean;
  nightlyBreakdown: NightlyBreakdownItem[];
  baseNightlyRate: number;
  discountPercentApplied: number;
  extraGuestsCount: number;
  totalExtraGuestCharges: number;
  feesAndTaxes: number;
  totalPrice: number;
  inlinePolicySnippets: typeof import('../../../content/terms').inlinePolicySnippets;
  isRazorpayReady: boolean;
  isLoading: boolean;
  termsAccepted: boolean;
  setTermsAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  termsAcceptedAt: string | null;
  setTermsAcceptedAt: React.Dispatch<React.SetStateAction<string | null>>;
  initiatePayment: () => void;
  primaryCtaLabel: string;
  paymentStatus:
    | { state: 'idle' }
    | {
        state: 'success';
        paymentId: string;
        bookingId: string;
      }
    | {
        state: 'failure';
        reason: string;
      };
  setPaymentStatus: React.Dispatch<
    React.SetStateAction<
      | { state: 'idle' }
      | {
          state: 'success';
          paymentId: string;
          bookingId: string;
        }
      | {
          state: 'failure';
          reason: string;
        }
    >
  >;
  formatGuestLabel: () => string;
  dates: { startDate: Date; endDate: Date };
  FaUserFriendsIcon: typeof FaUserFriends;
  SiRazorpayIcon: typeof SiRazorpay;
  FaCreditCardIcon: typeof FaCreditCard;
  SiGooglepayIcon: typeof SiGooglepay;
  FaCcVisaIcon: typeof FaCcVisa;
  FaCcMastercardIcon: typeof FaCcMastercard;
}

export const BookingCardPricingPaymentSection: React.FC<BookingCardPricingPaymentSectionProps> = ({
  hasSelection,
  hasInteractedWithDates,
  nightlyBreakdown,
  baseNightlyRate,
  discountPercentApplied,
  extraGuestsCount,
  totalExtraGuestCharges,
  feesAndTaxes,
  totalPrice,
  inlinePolicySnippets: inlineSnippets,
  isRazorpayReady,
  isLoading,
  termsAccepted,
  setTermsAccepted,
  termsAcceptedAt,
  setTermsAcceptedAt,
  initiatePayment,
  primaryCtaLabel,
  paymentStatus,
  setPaymentStatus,
  formatGuestLabel,
  dates,
  FaUserFriendsIcon,
  SiRazorpayIcon,
  FaCreditCardIcon,
  SiGooglepayIcon,
  FaCcVisaIcon,
  FaCcMastercardIcon,
}) => {
  return (
    <>
      {hasSelection && hasInteractedWithDates && (
        <div
          id="pricing-breakdown"
          className="mt-6 space-y-3 border border-border-subtle rounded-xl p-4 bg-bg-surface shadow-level1"
        >
          <div className="space-y-2">
            {nightlyBreakdown.map((night) => (
              <div className="flex justify-between text-sm" key={night.date.toISOString()}>
                <span className="flex items-center gap-2">
                  {format(night.date, 'dd MMM')}{' '}
                  {night.breakdown.isNewYearsEve && (
                    <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-0.5 text-[11px] font-semibold text-cta-primary">
                      New Year’s Eve pricing (2×)
                    </span>
                  )}
                </span>
                <span>₹{night.breakdown.finalNightlyPrice.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-text-muted">
            <span>Base price</span>
            <span>₹{baseNightlyRate.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm text-cta-primary">
            <span>Discount ({discountPercentApplied}%) applied</span>
            <span>Included</span>
          </div>
          {extraGuestsCount > 0 && (
            <div className="flex justify-between text-sm text-text-primary">
              <span>Extra guests ({extraGuestsCount})</span>
              <span>₹{totalExtraGuestCharges.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-text-primary">
            <span>Fees &amp; taxes (est.)</span>
            <span>₹{feesAndTaxes.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-text-primary border-t pt-3">
            <span>Total</span>
            <span>₹{totalPrice.toLocaleString('en-IN')}</span>
          </div>
          <p className="text-xs text-text-muted">
            No hidden charges — everything is shown upfront for your dates and guest count.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-3 text-sm text-text-primary border border-border-subtle rounded-xl p-4 bg-bg-muted">
        <div>
          <p className="font-semibold text-text-primary">Guest details</p>
          <p>
            {inlineSnippets.guestId}{' '}
            <a className="underline" href="/terms#guests">
              Read more
            </a>
          </p>
        </div>
        <div>
          <p className="font-semibold text-text-primary">Cancellations</p>
          <p>
            {inlineSnippets.cancellation}{' '}
            <a className="underline" href="/terms#cancellations">
              Policy
            </a>
          </p>
        </div>
        <div>
          <p className="font-semibold text-text-primary">House rules &amp; damages</p>
          <p>{inlineSnippets.houseRules}</p>
          <p className="mt-1">
            {inlineSnippets.damages}{' '}
            <a className="underline" href="/terms#damages">
              Damages
            </a>
          </p>
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <div className="p-4 border border-border-subtle rounded-xl bg-bg-surface shadow-level1">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="payment-method"
              className="h-5 w-5 text-cta-primary focus:ring-cta-primary"
              defaultChecked
              disabled={isLoading}
            />
            <div className="flex items-center">
              <img src="https://cdn.razorpay.com/logo.svg" alt="Razorpay" className="h-6 mr-2" />
              <span className="text-text-primary">Pay with Razorpay</span>
            </div>
          </label>
          <p className="text-sm text-text-muted mt-2">{inlineSnippets.paymentConsent}</p>
          <p className="text-xs text-text-muted mt-1">
            {isRazorpayReady
              ? 'Inline Razorpay checkout is ready.'
              : 'Preloading secure Razorpay checkout...'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--support-success) 12%, var(--bg-surface))',
                color: 'var(--support-success)',
              }}
            >
              <SiRazorpayIcon className="text-success" /> Razorpay secured
            </span>
            <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
              <FaCreditCardIcon /> Cards
            </span>
            <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
              <SiGooglepayIcon /> UPI
            </span>
            <span className="inline-flex items-center gap-1 bg-bg-muted text-text-primary px-2 py-1 rounded-full">
              <FaCcVisaIcon />
              <FaCcMastercardIcon />
            </span>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={termsAccepted}
            onChange={(event) => {
              setTermsAccepted(event.target.checked);
              setTermsAcceptedAt(event.target.checked ? new Date().toISOString() : null);
            }}
          />
          <span>
            I agree to the{' '}
            <a className="underline" href="/terms">
              Terms &amp; Conditions
            </a>{' '}
            and the policies above.
            {termsAcceptedAt && (
              <span className="block text-text-muted">
                Accepted at {new Date(termsAcceptedAt).toLocaleString()}
              </span>
            )}
          </span>
        </label>

        <button
          onClick={initiatePayment}
          disabled={isLoading || !termsAccepted}
          className="bg-cta-primary hover:bg-cta-secondary text-[var(--text-contrast)] w-full rounded-full py-4 text-lg font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-level1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--text-contrast)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            primaryCtaLabel
          )}
        </button>

        {paymentStatus.state === 'success' && (
          <div
            className="rounded-xl p-4 space-y-2 border"
            style={{
              borderColor: 'color-mix(in srgb, var(--support-success) 35%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--support-success) 12%, var(--bg-surface))',
            }}
          >
            <p className="text-success font-semibold">Payment received!</p>
            <p className="text-sm text-text-primary">
              Booking ID:{' '}
              <span className="font-mono font-semibold">{paymentStatus.bookingId}</span>
            </p>
            <p className="text-sm text-text-primary">
              Payment reference:{' '}
              <span className="font-mono">{paymentStatus.paymentId}</span>
            </p>
            <p className="text-sm text-text-muted">
              We’ll confirm your stay shortly. In the meantime, you can save this booking ID and
              reach out for any changes.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <a
                className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary"
                href="tel:+919833899938"
              >
                Call concierge
              </a>
              <a
                className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary"
                href="mailto:stay@atlashomestays.com?subject=Booking%20Support&body=Booking%20ID%3A%20"
              >
                Email support
              </a>
              <button
                type="button"
                className="px-3 py-2 rounded-full bg-cta-secondary text-[var(--text-contrast)]"
                onClick={() => setPaymentStatus({ state: 'idle' })}
              >
                Hide message
              </button>
            </div>
          </div>
        )}

        {paymentStatus.state === 'failure' && (
          <div
            className="rounded-xl p-4 space-y-2 border"
            style={{
              borderColor: 'color-mix(in srgb, var(--support-danger) 35%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--support-danger) 12%, var(--bg-surface))',
            }}
          >
            <p className="text-danger font-semibold">Payment was not completed</p>
            <p className="text-sm text-text-primary">{paymentStatus.reason}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={initiatePayment}
                className="px-3 py-2 rounded-full bg-cta-secondary text-[var(--text-contrast)]"
                disabled={isLoading}
              >
                Try again
              </button>
              <a
                className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary"
                href="tel:+919833899938"
              >
                Call to pay
              </a>
              <a
                className="px-3 py-2 rounded-full bg-bg-surface border border-border-subtle text-cta-primary"
                href="mailto:stay@atlashomestays.com?subject=Payment%20Assistance&body=Please%20help%20me%20complete%20my%20booking."
              >
                Get help via email
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-5 border-t pt-4">
        <div>
          <p className="text-lg font-semibold">Total Amount</p>
          <p className="text-sm text-text-muted">
            Inclusive of estimated taxes and fees
          </p>
        </div>
        <p className="text-lg font-bold">₹{totalPrice.toLocaleString('en-IN')}</p>
      </div>

      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border-subtle shadow-level2 px-4 py-3 flex items-center justify-between gap-3 z-[var(--z-sticky)]"
        style={{
          paddingBottom:
            'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 0.75rem)',
        }}
      >
        <div className="flex flex-col text-xs text-text-muted">
          <div className="font-semibold text-text-primary text-sm">
            {format(dates.startDate, 'dd MMM')} - {format(dates.endDate, 'dd MMM')}
          </div>
          <div className="flex items-center gap-1 text-text-primary text-sm">
            <FaUserFriendsIcon className="h-4 w-4" />
            <span>{formatGuestLabel()}</span>
          </div>
          <p className="text-[11px] text-text-muted">No hidden charges</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">Total</p>
          <p className="text-lg font-semibold">₹{totalPrice.toLocaleString('en-IN')}</p>
          <button
            onClick={initiatePayment}
            disabled={isLoading || !termsAccepted}
            className="mt-1 bg-cta-primary hover:bg-cta-secondary text-[var(--text-contrast)] rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-level1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
          >
            {primaryCtaLabel}
          </button>
        </div>
      </div>
    </>
  );
};

export default BookingCardPricingPaymentSection;
