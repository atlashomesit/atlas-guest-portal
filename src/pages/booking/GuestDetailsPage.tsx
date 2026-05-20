/**
 * TASK-2612: GuestDetailsPage — step 2 of the two-step booking flow.
 *
 * Receives holdId + holdExpiresAt from BookingContext (set by UnitBookingWidget Reserve).
 * Collects guest PII, submits final-charge POST /api/Razorpay/order, opens Razorpay modal.
 *
 * Visual: matches Claude Design bundle (post-reserve-checkout) exactly.
 * Copy: verbatim from handoff.jsx CopyTable.
 * CSS: .gd-* tokens from styles.css (inlined as module-level style tag).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useBooking } from '@/contexts/BookingContext';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { apiFetch } from '@/lib/http';
import {
  clampNationalDigits,
  getGuestDialOption,
  GUEST_DIAL_OPTIONS,
  toGuestPhoneE164,
  toRazorpayContactDigits,
} from '@/utils/guestPhoneDial';
import { getTenantContext } from '@/tenant/tenantContext';
import { getGuestDataProcessingEntityName } from '@/tenant/displayBrand';
import { formatCurrency } from '@/utils/formatting';
import { formatDateInTimezone } from '@/utils/dateHelpers';
import { track } from '@/lib/events';
import { mapRazorpayFailureCode } from '@/utils/razorpayGuestErrors';

declare global {
  interface Window {
    Razorpay: new (...args: unknown[]) => { open: () => void; on: (event: string, handler: (r: unknown) => void) => void };
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AddOnService {
  addOnServiceId: number;
  name: string;
  description?: string | null;
  price: number;
  priceType: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const LAST_UPI_VPA_KEY = 'atlas_last_upi_vpa';

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function _abandonHold(holdId: number, prepToken: string | null) {
  if (!prepToken) return;
  try {
    const url = buildApiUrl(`/api/guest/bookings/${holdId}/abandon-checkout?t=${encodeURIComponent(prepToken)}`);
    await apiFetch(url, { method: 'POST' });
  } catch { /* non-blocking */ }
}

function loadRazorpayScript(callback: () => void) {
  if (window.Razorpay) { callback(); return; }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => callback();
  script.onerror = () => callback(); // let caller handle failure
  document.body.appendChild(script);
}

// ── GuestDetailsPage ─────────────────────────────────────────────────────────

const GuestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { propertySlug, unitSlug } = useParams<{ propertySlug: string; unitSlug: string }>();
  const { booking, updateBooking } = useBooking();

  // ── Hold state from context ──────────────────────────────────────────────
  const holdId = booking.holdId;
  const holdExpiresAt = booking.holdExpiresAt;
  const holdListingId = booking.holdListingId;
  const priceBreakdown = booking.holdPriceBreakdown;

  // Redirect if no hold state (user navigated directly without Reserve)
  useEffect(() => {
    if (!holdId || !holdExpiresAt) {
      const backPath =
        propertySlug && unitSlug
          ? `/homes/${propertySlug}/${unitSlug}`
          : '/';
      navigate(backPath, { replace: true });
    }
  }, [holdId, holdExpiresAt, propertySlug, unitSlug, navigate]);

  // ── Hold countdown ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(() =>
    holdExpiresAt ? formatCountdown(holdExpiresAt) : '0:00',
  );
  const [holdExpired, setHoldExpired] = useState(false);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const remaining = new Date(holdExpiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('0:00');
        setHoldExpired(true);
        return;
      }
      setCountdown(formatCountdown(holdExpiresAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [phoneDialCode, setPhoneDialCode] = useState(() => GUEST_DIAL_OPTIONS[0].code);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    nationality: 'India',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true); // pre-checked per spec

  // ── Progressive disclosure state ──────────────────────────────────────────
  const [promoOpen, setPromoOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [addOnsOpen, setAddOnsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // ── Promo / Referral ─────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState(() => {
    try { return (window.localStorage.getItem('atlas_guest_promo_code') || '').slice(0, 32); } catch { return ''; }
  });
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoDiscountAmount, setPromoDiscountAmount] = useState(0);

  const [referralCode, setReferralCode] = useState(() => {
    try { return (window.localStorage.getItem('atlas_guest_referral_code') || '').slice(0, 32); } catch { return ''; }
  });
  const [referralMessage, setReferralMessage] = useState<string | null>(null);
  const [referralValidating, setReferralValidating] = useState(false);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [referralDiscountAmount, setReferralDiscountAmount] = useState(0);

  // ── Add-ons ───────────────────────────────────────────────────────────────
  const [availableAddOns, setAvailableAddOns] = useState<AddOnService[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<number, number>>({});

  useEffect(() => {
    const id = holdListingId != null ? Number(holdListingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    void (async () => {
      try {
        const url = buildApiUrl(`/listings/${id}/add-ons`);
        const res = await fetch(url, { headers: getApiHeaders() });
        if (res.ok) {
          const data = (await res.json()) as AddOnService[];
          setAvailableAddOns(Array.isArray(data) ? data : []);
        }
      } catch { /* non-critical */ }
    })();
  }, [holdListingId]);

  const addOnsTotal = useMemo(
    () =>
      availableAddOns.reduce((sum, ao) => {
        const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
        return sum + (qty > 0 ? ao.price * qty : 0);
      }, 0),
    [availableAddOns, selectedAddOns],
  );

  // ── Pricing ───────────────────────────────────────────────────────────────
  const baseAmount = priceBreakdown?.baseAmount ?? 0;
  const convenienceFeeAmount = priceBreakdown?.convenienceFeeAmount ?? 0;
  const nights = priceBreakdown?.nights ?? 0;
  const displayTotal = Math.max(
    1,
    baseAmount + convenienceFeeAmount + addOnsTotal - promoDiscountAmount - referralDiscountAmount,
  );
  const displayPrice = (n: number) => formatCurrency(n, { maximumFractionDigits: 0 });

  // GST extraction
  const perNight = nights > 0 ? Math.round(baseAmount / nights) : 0;
  const gstSlabPercent = perNight > 0 ? (perNight <= 7500 ? 5 : 12) : null;
  const gstLineAmount =
    gstSlabPercent != null && baseAmount > 0
      ? Math.max(1, Math.round((baseAmount * gstSlabPercent) / (100 + gstSlabPercent)))
      : 0;

  // ── Check-in/out display ─────────────────────────────────────────────────
  const checkInDisplay = booking.checkIn
    ? formatDateInTimezone(new Date(booking.checkIn), 'Asia/Kolkata')
    : '—';
  const checkOutDisplay = booking.checkOut
    ? formatDateInTimezone(new Date(booking.checkOut), 'Asia/Kolkata')
    : '—';

  // Free cancellation date = 48h before check-in
  const freeCancelDisplay = useMemo(() => {
    if (!booking.checkIn) return null;
    const d = new Date(new Date(booking.checkIn).getTime() - 48 * 60 * 60 * 1000);
    return formatDateInTimezone(d, 'Asia/Kolkata');
  }, [booking.checkIn]);

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [_razorpayAmount, setRazorpayAmount] = useState<number | null>(null);
  const pendingBookingTokenRef = useRef<string | null>(null);

  // ── Form validation ───────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    const errors = { name: '', email: '', phone: '' };
    let valid = true;

    if (!formData.name.trim()) { errors.name = 'Name is required'; valid = false; }

    if (!formData.email) { errors.email = 'Email is required'; valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address'; valid = false;
    }

    const dial = getGuestDialOption(phoneDialCode);
    const national = clampNationalDigits(formData.phone, dial.maxDigits);
    if (!national) { errors.phone = 'Phone number is required'; valid = false; }
    else if (!dial.validate(national)) { errors.phone = dial.invalidMessage; valid = false; }

    if (!consentAccepted) { setConsentError('Please accept the consent to continue.'); valid = false; }
    else { setConsentError(''); }

    setFormErrors(errors);
    return valid;
  }, [formData, phoneDialCode, consentAccepted]);

  // ── Promo / Referral blur handlers ────────────────────────────────────────
  const handlePromoBlur = useCallback(async () => {
    const code = promoCode.trim();
    if (!code || !holdListingId) return;
    setPromoValidating(true);
    setPromoMessage(null);
    try {
      const res = await fetch(buildApiUrl('/api/promo-codes/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders() },
        body: JSON.stringify({ code, listingId: Number(holdListingId), subtotal: baseAmount }),
      });
      if (!res.ok) { setPromoMessage('Could not validate code — try again.'); return; }
      const data = (await res.json()) as { valid: boolean; message: string; discountAmount?: number };
      setPromoMessage(data.message);
      if (data.valid) {
        setAppliedPromoCode(code);
        if (typeof data.discountAmount === 'number' && data.discountAmount > 0) {
          setPromoDiscountAmount(data.discountAmount);
        }
      }
    } catch {
      setPromoMessage('Could not validate code — check your connection.');
    } finally {
      setPromoValidating(false);
    }
  }, [promoCode, holdListingId, baseAmount]);

  const handleReferralBlur = useCallback(() => {
    const code = referralCode.trim();
    if (!code) { setReferralMessage(null); setAppliedReferralCode(null); return; }
    setReferralValidating(true);
    setTimeout(() => {
      if (/^[A-Z0-9]{1,32}$/.test(code)) {
        setAppliedReferralCode(code);
        setReferralMessage('Code format looks good — reward will apply if eligible at checkout.');
      } else {
        setAppliedReferralCode(null);
        setReferralMessage('Referral codes must be letters and numbers only (no spaces or symbols).');
      }
      setReferralValidating(false);
    }, 300);
  }, [referralCode]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting || holdExpired) return;
      if (!validateForm()) return;

      const numericHoldId = holdId != null ? Number(holdId) : NaN;
      if (!Number.isFinite(numericHoldId)) {
        setOrderError('Hold not found. Please go back and select dates again.');
        return;
      }

      setIsSubmitting(true);
      setOrderError(null);
      setPaymentCancelled(false);

      const dial = getGuestDialOption(phoneDialCode);
      const e164Phone = toGuestPhoneE164(phoneDialCode, clampNationalDigits(formData.phone, dial.maxDigits));

      // Build selectedAddOns list
      const selectedAddOnsList = availableAddOns
        .filter((ao) => (selectedAddOns[ao.addOnServiceId] ?? 0) > 0)
        .map((ao) => ({ addOnServiceId: ao.addOnServiceId, quantity: selectedAddOns[ao.addOnServiceId] }));

      const payload = {
        holdId: numericHoldId,
        currency: 'INR',
        guestConsentAccepted: true,
        securityDepositAccepted: false,
        guestInfo: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: e164Phone,
          marketingWhatsAppOptIn: whatsappOptIn,
        },
        referralCode: referralCode.trim() || undefined,
        promoCode: promoCode.trim() || undefined,
        bookingDraft: {
          notes: formData.notes.trim().slice(0, 500) || undefined,
          guestNationality: formData.nationality || 'India',
          selectedAddOns: selectedAddOnsList.length > 0 ? selectedAddOnsList : undefined,
        },
      };

      try {
        const idempotencyKey = crypto.randomUUID();
        const numericListingId = holdListingId ? Number(holdListingId) : 0;
        track('start_checkout', numericListingId);

        const response = await axios.post(buildApiUrl('/api/Razorpay/order'), payload, {
          headers: {
            ...getApiHeaders(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          timeout: 15000,
        });

        const {
          keyId,
          orderId,
          bookingId,
          bookingToken,
          amount,
          appliedReferralCode: serverReferralCode,
          referralDiscountAmount: serverReferralDiscount,
          appliedPromoCode: serverPromoCode,
          promoDiscountAmount: serverPromoDiscount,
        } = response.data ?? {};

        if (!keyId || !orderId || !bookingId) {
          throw new Error('Checkout could not start: invalid response. Please try again.');
        }

        // Update applied discounts from server
        if (typeof serverReferralCode === 'string' && serverReferralCode.trim()) {
          setAppliedReferralCode(serverReferralCode.trim());
          setReferralDiscountAmount(Number(serverReferralDiscount) > 0 ? Number(serverReferralDiscount) : 0);
        }
        if (typeof serverPromoCode === 'string' && serverPromoCode.trim()) {
          setAppliedPromoCode(serverPromoCode.trim());
          setPromoDiscountAmount(Number(serverPromoDiscount) > 0 ? Number(serverPromoDiscount) : 0);
        }

        setRazorpayOrderId(orderId);
        setRazorpayAmount(Number(amount));
        pendingBookingTokenRef.current = typeof bookingToken === 'string' ? bookingToken.trim() : null;

        loadRazorpayScript(() => {
          if (!window.Razorpay) {
            setOrderError("Couldn't reach our servers. Your details are saved — check your connection and try again. No payment was taken.");
            setIsSubmitting(false);
            return;
          }
          try {
            let paymentCompleted = false;

            let lastUpiVpa = '';
            try { lastUpiVpa = localStorage.getItem(LAST_UPI_VPA_KEY)?.trim() ?? ''; } catch { /* ignore */ }

            const handleClose = () => {
              if (paymentCompleted) return;
              paymentCompleted = true;
              setIsSubmitting(false);
              setPaymentCancelled(true);
              setRazorpayOrderId(null);
            };

            const options = {
              key: keyId,
              amount: Number(amount),
              currency: 'INR',
              name: getTenantContext()?.displayMerchantName ?? getTenantContext()?.name ?? 'Our Property',
              description: `Booking confirmation`,
              order_id: orderId,
              prefill: {
                name: formData.name.trim(),
                email: formData.email.trim(),
                contact: toRazorpayContactDigits(
                  phoneDialCode,
                  clampNationalDigits(formData.phone, dial.maxDigits),
                ),
                method: 'upi',
                ...(lastUpiVpa ? { vpa: lastUpiVpa } : {}),
              },
              upi: { flow: 'collect', ...(lastUpiVpa ? { vpa: lastUpiVpa } : {}) },
              config: {
                display: {
                  blocks: {
                    upi_collect: {
                      name: 'Pay using UPI ID',
                      instruments: [{ method: 'upi', flows: ['collect'] }],
                    },
                  },
                  sequence: ['block.upi_collect', 'block.card', 'block.netbanking', 'block.wallet'],
                  preferences: { show_default_blocks: true },
                },
              },
              theme: { color: '#2563eb' },
              modal: { ondismiss: handleClose },
              handler: async (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                paymentCompleted = true;
                try {
                  const verifyRes = await axios.post(
                    buildApiUrl('/api/Razorpay/verify'),
                    {
                      bookingId: Number(bookingId),
                      razorpayOrderId: res.razorpay_order_id,
                      razorpayPaymentId: res.razorpay_payment_id,
                      razorpaySignature: res.razorpay_signature,
                      guestInfo: {
                        name: formData.name.trim(),
                        email: formData.email.trim(),
                        phone: e164Phone,
                      },
                    },
                    { headers: { ...getApiHeaders(), 'Content-Type': 'application/json' }, timeout: 15000 },
                  );
                  if (verifyRes.data?.success) {
                    // Store last UPI VPA
                    const vpa = typeof verifyRes.data.lastUpiVpa === 'string' ? verifyRes.data.lastUpiVpa.trim() : '';
                    if (vpa) { try { localStorage.setItem(LAST_UPI_VPA_KEY, vpa); } catch { /* ignore */ } }
                    // Store guest identity
                    try {
                      localStorage.setItem('atlas_guest_email', formData.email.trim());
                      if (formData.name.trim()) localStorage.setItem('atlas_guest_name', formData.name.trim());
                    } catch { /* ignore */ }
                    // Clear hold state
                    updateBooking({
                      holdId: null, holdExpiresAt: null, holdPropertySlug: null,
                      holdUnitSlug: null, holdPriceBreakdown: null, holdListingId: null,
                      paymentHoldBookingId: null, paymentHoldToken: null,
                    });
                    const token = pendingBookingTokenRef.current;
                    navigate(
                      token
                        ? `/booking/${bookingId}?t=${encodeURIComponent(token)}`
                        : `/booking/${bookingId}`,
                      { replace: true },
                    );
                  } else {
                    throw new Error(verifyRes.data?.message || 'Payment verification failed.');
                  }
                } catch (err) {
                  console.error('[GuestDetailsPage] verify error:', err);
                  setOrderError(`Payment verification failed. Please contact support with your payment ID if you were charged.`);
                } finally {
                  setIsSubmitting(false);
                }
              },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (failRes: unknown) => {
              paymentCompleted = true;
              const fr = failRes as { error?: { code?: string; description?: string } };
              const code = String(fr?.error?.code ?? '');
              const desc = String(fr?.error?.description ?? '');
              setOrderError(mapRazorpayFailureCode(code, desc));
              setIsSubmitting(false);
            });
            rzp.on('close', handleClose);

            track('payment_init', holdListingId ? Number(holdListingId) : 0);
            rzp.open();
          } catch (err) {
            console.error('[GuestDetailsPage] Razorpay init error:', err);
            setOrderError("Couldn't reach our servers. Your details are saved — check your connection and try again. No payment was taken.");
            setIsSubmitting(false);
          }
        });
      } catch (err: unknown) {
        console.error('[GuestDetailsPage] order error:', err);
        const status = (err as { response?: { status?: number } })?.response?.status;
        const data = (err as { response?: { data?: { message?: string; code?: string } } })?.response?.data;
        const serverMessage = typeof data?.message === 'string' ? data.message : '';

        if (status === 409) {
          const datesLabel =
            booking.checkIn && booking.checkOut
              ? `${checkInDisplay} – ${checkOutDisplay}`
              : 'those dates';
          setOrderError(
            `Someone else just booked these dates. We couldn't confirm ${datesLabel}. Pick different dates to continue. No payment was taken.`,
          );
        } else if (serverMessage) {
          setOrderError(`Couldn't start payment. ${serverMessage}`);
        } else {
          setOrderError("Couldn't reach our servers. Your details are saved — check your connection and try again. No payment was taken.");
        }
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting, holdExpired, validateForm, holdId, phoneDialCode, formData,
      availableAddOns, selectedAddOns, referralCode, promoCode, whatsappOptIn,
      holdListingId, updateBooking, navigate, booking.checkIn, booking.checkOut,
      checkInDisplay, checkOutDisplay,
    ],
  );

  // ── "Resume payment" when Razorpay cancelled but order exists ─────────────
  const handleResume = useCallback(() => {
    setPaymentCancelled(false);
    setOrderError(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!holdId || !holdExpiresAt) return null; // guard: redirect handled by useEffect

  const tenantCtx = getTenantContext();
  const brandName = tenantCtx?.name ?? 'Atlas';
  const whatsappNumber = tenantCtx?.whatsappBookingPhone ?? '';
  const consentEntityName = getGuestDataProcessingEntityName();

  return (
    <div className="gd-page">
      {/* Hold strip — desktop top */}
      <div className="gd-hold" data-testid="hold-strip">
        <span className="gd-hold-icon">⏱</span>
        <span className="gd-hold-text">
          Your dates are reserved for the next <strong className="gd-hold-timer">{countdown}</strong>.
          {' '}Finish payment to confirm — we won't release them while you're here.
        </span>
      </div>

      {/* Expired modal */}
      {holdExpired && (
        <div className="gd-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="gd-expired-title">
          <div className="gd-modal">
            <div className="gd-modal-icon">⏰</div>
            <h2 id="gd-expired-title" className="gd-modal-title">Your hold just expired.</h2>
            <p className="gd-modal-body">
              The 15-minute reservation has ended and those dates are back on the calendar.
              Re-select to continue — your details aren't lost.
            </p>
            <button
              type="button"
              className="gd-modal-cta"
              onClick={() => {
                updateBooking({
                  holdId: null, holdExpiresAt: null, holdPropertySlug: null,
                  holdUnitSlug: null, holdPriceBreakdown: null, holdListingId: null,
                });
                const back = propertySlug && unitSlug
                  ? `/homes/${propertySlug}/${unitSlug}`
                  : '/';
                navigate(back, { replace: true });
              }}
            >
              Choose dates again
            </button>
          </div>
        </div>
      )}

      <div className="gd-layout">
        {/* ── Left column: form ── */}
        <div className="gd-main">
          {/* Recap strip */}
          <div className="gd-recap" data-testid="booking-recap">
            <div className="gd-recap-dates">
              <span className="gd-recap-label">Check-in</span>
              <strong>{checkInDisplay}</strong>
            </div>
            <div className="gd-recap-sep" aria-hidden="true" />
            <div className="gd-recap-dates">
              <span className="gd-recap-label">Check-out</span>
              <strong>{checkOutDisplay}</strong>
            </div>
            <div className="gd-recap-sep" aria-hidden="true" />
            <div className="gd-recap-dates">
              <span className="gd-recap-label">Guests</span>
              <strong>{booking.guests ?? 1}</strong>
            </div>
            {propertySlug && unitSlug && (
              <Link to={`/homes/${propertySlug}/${unitSlug}`} className="gd-recap-edit" aria-label="Edit booking details">
                ✎ Edit
              </Link>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate className="gd-form" id="gd-details-form">
            <h1 className="gd-form-heading">Your details</h1>
            <p className="gd-form-sub">We'll send your booking confirmation and check-in info here.</p>

            {/* Required fields */}
            <div className="gd-fset">
              {/* Full name */}
              <div className="gd-field">
                <label className="gd-label" htmlFor="gd-name">
                  Full name <span className="gd-req" aria-hidden="true">*</span>
                </label>
                <input
                  id="gd-name"
                  type="text"
                  autoComplete="name"
                  className={`gd-input${formErrors.name ? ' gd-input--error' : ''}`}
                  placeholder="As on a government ID"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  data-testid="guest-booking-name"
                />
                {formErrors.name && <span className="gd-field-err" role="alert">{formErrors.name}</span>}
              </div>

              {/* Email */}
              <div className="gd-field">
                <label className="gd-label" htmlFor="gd-email">
                  Email <span className="gd-req" aria-hidden="true">*</span>
                </label>
                <input
                  id="gd-email"
                  type="email"
                  autoComplete="email"
                  className={`gd-input${formErrors.email ? ' gd-input--error' : ''}`}
                  placeholder="Booking confirmation goes here"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  data-testid="guest-booking-email"
                />
                {formErrors.email && <span className="gd-field-err" role="alert">{formErrors.email}</span>}
              </div>

              {/* Phone */}
              <div className="gd-field">
                <label className="gd-label" htmlFor="gd-phone">
                  Phone <span className="gd-req" aria-hidden="true">*</span>
                </label>
                <div className={`gd-phone-wrap${formErrors.phone ? ' gd-input--error' : ''}`}>
                  <select
                    aria-label="Country calling code"
                    value={phoneDialCode}
                    onChange={(e) => {
                      setPhoneDialCode(e.target.value);
                      const dial = getGuestDialOption(e.target.value);
                      setFormData((p) => ({ ...p, phone: clampNationalDigits(p.phone, dial.maxDigits) }));
                    }}
                    className="gd-dial"
                    data-testid="guest-booking-phone-dial"
                  >
                    {GUEST_DIAL_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    id="gd-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="gd-phone-input"
                    placeholder={getGuestDialOption(phoneDialCode).placeholder}
                    maxLength={getGuestDialOption(phoneDialCode).maxDigits}
                    value={formData.phone}
                    onChange={(e) => {
                      const dial = getGuestDialOption(phoneDialCode);
                      setFormData((p) => ({
                        ...p,
                        phone: clampNationalDigits(e.target.value, dial.maxDigits),
                      }));
                    }}
                    data-testid="guest-booking-phone"
                  />
                </div>
                <span className="gd-hint">We'll WhatsApp you check-in details.</span>
                {formErrors.phone && <span className="gd-field-err" role="alert">{formErrors.phone}</span>}
              </div>

              {/* Nationality */}
              <div className="gd-field gd-field--compact">
                <label className="gd-label" htmlFor="gd-nationality">
                  Nationality <span className="gd-req" aria-hidden="true">*</span>
                </label>
                <select
                  id="gd-nationality"
                  className="gd-input"
                  value={formData.nationality}
                  onChange={(e) => setFormData((p) => ({ ...p, nationality: e.target.value }))}
                  data-testid="guest-booking-nationality"
                >
                  {['India','Australia','Bangladesh','Bhutan','Canada','China','France','Germany',
                    'Indonesia','Japan','Malaysia','Maldives','Nepal','Pakistan','Philippines',
                    'Singapore','South Korea','Sri Lanka','Thailand','UAE','UK','USA','Vietnam','Other'
                  ].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="gd-hint-subtle">Required for police homestay records.</span>
              </div>
            </div>

            {/* Progressive disclosures */}
            <div className="gd-disclosures">
              {/* Promo code */}
              <details className="gd-disclosure" open={promoOpen} onToggle={(e) => setPromoOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="gd-disclosure-summary">
                  <span className="gd-disclosure-icon">🏷</span>
                  Promo code
                  {appliedPromoCode && <span className="gd-badge-applied">{appliedPromoCode}</span>}
                </summary>
                <div className="gd-disclosure-body">
                  <input
                    type="text"
                    className="gd-input"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32));
                      setPromoMessage(null);
                      setAppliedPromoCode(null);
                      setPromoDiscountAmount(0);
                    }}
                    onBlur={() => void handlePromoBlur()}
                    data-testid="guest-booking-promo"
                  />
                  {promoValidating && <span className="gd-hint">Validating…</span>}
                  {!promoValidating && promoMessage && (
                    <span className={`gd-hint${appliedPromoCode ? ' gd-hint--ok' : ' gd-hint--err'}`}>
                      {promoMessage}
                    </span>
                  )}
                  {!promoValidating && !promoMessage && (
                    <span className="gd-hint">That code doesn't apply to your dates. Promo codes are case-insensitive — double-check spelling.</span>
                  )}
                </div>
              </details>

              {/* Referral code */}
              <details className="gd-disclosure" open={referralOpen} onToggle={(e) => setReferralOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="gd-disclosure-summary">
                  <span className="gd-disclosure-icon">🎁</span>
                  Referral code
                  {appliedReferralCode && <span className="gd-badge-applied">{appliedReferralCode}</span>}
                </summary>
                <div className="gd-disclosure-body">
                  <input
                    type="text"
                    className="gd-input"
                    placeholder="Enter referral code"
                    value={referralCode}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
                      setReferralCode(next);
                      setReferralMessage(null);
                      setAppliedReferralCode(null);
                      setReferralDiscountAmount(0);
                      if (next) { try { localStorage.setItem('atlas_guest_referral_code', next); } catch { /* ignore */ } }
                    }}
                    onBlur={handleReferralBlur}
                    data-testid="guest-booking-referral"
                  />
                  {referralValidating && <span className="gd-hint">Validating…</span>}
                  {!referralValidating && referralMessage && (
                    <span className={`gd-hint${appliedReferralCode ? ' gd-hint--ok' : ' gd-hint--err'}`}>
                      {referralMessage}
                    </span>
                  )}
                </div>
              </details>

              {/* Add-ons */}
              {availableAddOns.length > 0 && (
                <details className="gd-disclosure" open={addOnsOpen} onToggle={(e) => setAddOnsOpen((e.target as HTMLDetailsElement).open)}>
                  <summary className="gd-disclosure-summary">
                    <span className="gd-disclosure-icon">✨</span>
                    Add-on services
                    {addOnsTotal > 0 && <span className="gd-badge-applied">+{displayPrice(addOnsTotal)}</span>}
                  </summary>
                  <div className="gd-disclosure-body">
                    {availableAddOns.map((ao) => {
                      const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
                      return (
                        <div key={ao.addOnServiceId} className="gd-addon-row">
                          <div className="gd-addon-info">
                            <span className="gd-addon-name">{ao.name}</span>
                            {ao.description && <span className="gd-addon-desc">{ao.description}</span>}
                            <span className="gd-addon-price">{displayPrice(ao.price)} / {ao.priceType.replace('_', ' ')}</span>
                          </div>
                          <div className="gd-counter">
                            {qty > 0 && (
                              <>
                                <button
                                  type="button"
                                  className="gd-counter-btn"
                                  aria-label={`Remove one ${ao.name}`}
                                  onClick={() => setSelectedAddOns((p) => ({ ...p, [ao.addOnServiceId]: Math.max(0, (p[ao.addOnServiceId] ?? 0) - 1) }))}
                                >−</button>
                                <span className="gd-counter-val">{qty}</span>
                              </>
                            )}
                            <button
                              type="button"
                              className="gd-counter-btn"
                              aria-label={`Add ${ao.name}`}
                              onClick={() => setSelectedAddOns((p) => ({ ...p, [ao.addOnServiceId]: (p[ao.addOnServiceId] ?? 0) + 1 }))}
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Notes */}
              <details className="gd-disclosure" open={notesOpen} onToggle={(e) => setNotesOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="gd-disclosure-summary">
                  <span className="gd-disclosure-icon">📝</span>
                  Special requests
                </summary>
                <div className="gd-disclosure-body">
                  <textarea
                    className="gd-input gd-textarea"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. late check-in, dietary needs, celebration setup"
                    value={formData.notes}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                    data-testid="guest-booking-notes"
                  />
                  <span className="gd-hint">{formData.notes.length}/500</span>
                </div>
              </details>
            </div>

            {/* Consent */}
            <div className="gd-consent-box">
              <label className="gd-consent-row gd-consent--required">
                <input
                  type="checkbox"
                  className="gd-check"
                  checked={consentAccepted}
                  onChange={(e) => {
                    setConsentAccepted(e.target.checked);
                    if (e.target.checked) setConsentError('');
                  }}
                  aria-invalid={Boolean(consentError)}
                  data-testid="guest-booking-consent"
                />
                <span className="gd-consent-text">
                  I agree to {consentEntityName} contacting me about this booking, and to its{' '}
                  <Link to="/privacy" className="gd-link">Privacy Policy</Link> &amp;{' '}
                  <Link to="/terms" className="gd-link">Guest Terms</Link>.{' '}
                  <span className="gd-consent-badge">REQUIRED · DPDP ACT, 2023</span>
                </span>
              </label>
              {consentError && <span className="gd-field-err" role="alert">{consentError}</span>}

              <label className="gd-consent-row gd-consent--optional">
                <input
                  type="checkbox"
                  className="gd-check"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  aria-label="WhatsApp booking updates opt-in"
                />
                <span className="gd-consent-text gd-consent-text--muted">
                  Send my booking updates on WhatsApp — confirmations, directions, host messages.
                  {' '}<em>(Optional, you can opt out anytime.)</em>
                </span>
              </label>
            </div>

            {/* Error states */}
            {orderError && (
              <div className="gd-banner gd-banner--error" role="alert">
                <span className="gd-banner-icon">⚠</span>
                <span>{orderError}</span>
                {razorpayOrderId && (
                  <button type="button" className="gd-banner-cta" onClick={handleResume}>
                    Resume payment
                  </button>
                )}
              </div>
            )}
            {paymentCancelled && !orderError && (
              <div className="gd-banner gd-banner--info" role="status">
                Payment cancelled — no money taken. Your dates are still held for{' '}
                <strong>{countdown}</strong>. Ready to try again?
                <button type="button" className="gd-banner-cta" onClick={handleResume}>
                  Resume payment
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── Right column: price summary + Pay CTA ── */}
        <aside className="gd-aside">
          <div className="gd-price-card">
            <div className="gd-price-rows">
              <div className="gd-price-row">
                <span>Room fare</span>
                <span>{displayPrice(baseAmount)}</span>
              </div>
              {gstSlabPercent != null && gstLineAmount > 0 && (
                <div className="gd-price-row gd-price-row--sub">
                  <span>GST @ {gstSlabPercent}% on accommodation</span>
                  <span>{displayPrice(gstLineAmount)}</span>
                </div>
              )}
              {convenienceFeeAmount > 0 && (
                <div className="gd-price-row">
                  <span>Convenience fee</span>
                  <span>{displayPrice(convenienceFeeAmount)}</span>
                </div>
              )}
              {addOnsTotal > 0 && (
                <div className="gd-price-row">
                  <span>Add-ons</span>
                  <span>{displayPrice(addOnsTotal)}</span>
                </div>
              )}
              {promoDiscountAmount > 0 && (
                <div className="gd-price-row gd-price-row--discount">
                  <span>Promo ({appliedPromoCode})</span>
                  <span>−{displayPrice(promoDiscountAmount)}</span>
                </div>
              )}
              {referralDiscountAmount > 0 && (
                <div className="gd-price-row gd-price-row--discount">
                  <span>Referral reward</span>
                  <span>−{displayPrice(referralDiscountAmount)}</span>
                </div>
              )}
            </div>
            <div className="gd-price-total">
              <span>Total</span>
              <strong>{displayPrice(displayTotal)}</strong>
            </div>
            <p className="gd-price-micro">
              You'll be charged {displayPrice(displayTotal)} now to confirm.
              {freeCancelDisplay && ` Free cancellation until ${freeCancelDisplay}.`}
            </p>
          </div>

          {/* Trust band */}
          <div className="gd-trust">
            <div className="gd-trust-row">
              🛡 {freeCancelDisplay ? `Free cancellation until ${freeCancelDisplay} — 48 hours before check-in.` : 'Flexible cancellation policy applies.'}
            </div>
            <div className="gd-trust-row">
              🔒 Direct booking · secure payment via Razorpay · no OTA fee.
            </div>
            {whatsappNumber && (
              <div className="gd-trust-row">
                💬 Stuck? WhatsApp {brandName} on{' '}
                <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} className="gd-link" target="_blank" rel="noopener noreferrer">
                  {whatsappNumber}
                </a>.
              </div>
            )}
          </div>

          {/* Pay CTA */}
          <button
            type="submit"
            form="gd-details-form"
            className="gd-pay"
            disabled={isSubmitting || holdExpired}
            data-testid="guest-booking-submit"
          >
            {isSubmitting ? 'Securing your booking…' : `Pay ${displayPrice(displayTotal)} to confirm`}
          </button>
        </aside>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="gd-mobile-bar">
        <div className="gd-mobile-bar-left">
          <span className="gd-mobile-timer">{countdown} · Held</span>
          <span className="gd-mobile-total">{displayPrice(displayTotal)}</span>
        </div>
        <button
          type="submit"
          form="gd-details-form"
          className="gd-mobile-pay"
          disabled={isSubmitting || holdExpired}
          data-testid="guest-booking-submit-mobile"
        >
          {isSubmitting ? 'Securing…' : `Pay ${displayPrice(displayTotal)}`}
        </button>
      </div>

      {/* CSS scoped to .gd-page */}
      <style>{gdStyles}</style>
    </div>
  );
};

// ── Inline styles (mirrors styles.css from bundle, scoped to .gd-page) ────────
const gdStyles = `
:root {
  --gd-ink: #1a1a2e;
  --gd-coral: #c2410c;
  --gd-ivory: #fffaf5;
  --gd-peach: #ffe8d6;
  --gd-amber: #ffb347;
  --gd-green: #15803d;
  --gd-faint: #9ca3af;
  --gd-border: #e5e7eb;
  --gd-surface: #fff;
  --gd-hold-bg: #1a1a2e;
}

.gd-page {
  --nav-height: var(--nav-height, 64px);
  min-height: 100vh;
  background: var(--gd-ivory);
  font-family: inherit;
}

/* Hold strip */
.gd-hold {
  position: sticky;
  top: var(--nav-height);
  z-index: 30;
  background: var(--gd-hold-bg);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  font-size: 13px;
  line-height: 1.4;
}
.gd-hold-timer { color: var(--gd-amber); font-variant-numeric: tabular-nums; }

/* Layout */
.gd-layout {
  max-width: 1040px;
  margin: 0 auto;
  padding: 28px 20px 100px;
  display: grid;
  grid-template-columns: minmax(0, 560px) 360px;
  gap: 48px;
  align-items: start;
}
@media (max-width: 768px) {
  .gd-layout { grid-template-columns: 1fr; gap: 24px; padding-bottom: 120px; }
  .gd-aside { display: none; }
}

/* Recap */
.gd-recap {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: var(--gd-peach);
  border-radius: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.gd-recap-dates { display: flex; flex-direction: column; gap: 2px; }
.gd-recap-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--gd-coral); font-weight: 600; }
.gd-recap-sep { width: 1px; height: 28px; background: #d1c0b4; }
.gd-recap-edit { margin-left: auto; font-size: 12px; color: var(--gd-coral); text-decoration: none; }

/* Form */
.gd-form-heading { font-size: 22px; font-weight: 700; color: var(--gd-ink); margin: 0 0 4px; }
.gd-form-sub { font-size: 13px; color: var(--gd-faint); margin: 0 0 20px; }
.gd-fset { display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px; }
.gd-field { display: flex; flex-direction: column; gap: 4px; }
.gd-field--compact { }
.gd-label { font-size: 13px; font-weight: 600; color: var(--gd-ink); }
.gd-req { color: var(--gd-coral); margin-left: 2px; }
.gd-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--gd-border);
  border-radius: 10px;
  font-size: 14px;
  background: #fff;
  color: var(--gd-ink);
  box-sizing: border-box;
  outline: none;
  transition: border-color .15s;
}
.gd-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.gd-input--error { border-color: var(--gd-coral); }
.gd-textarea { resize: vertical; min-height: 80px; }
.gd-hint { font-size: 11px; color: var(--gd-faint); }
.gd-hint--ok { color: var(--gd-green); }
.gd-hint--err { color: var(--gd-coral); }
.gd-hint-subtle { font-size: 11px; color: var(--gd-faint); }
.gd-field-err { font-size: 11px; color: var(--gd-coral); }
.gd-phone-wrap { display: flex; border: 1.5px solid var(--gd-border); border-radius: 10px; overflow: hidden; background: #fff; }
.gd-phone-wrap.gd-input--error { border-color: var(--gd-coral); }
.gd-dial { border: 0; border-right: 1.5px solid var(--gd-border); background: transparent; padding: 10px 8px; font-size: 13px; color: var(--gd-ink); max-width: 150px; }
.gd-phone-input { border: 0; flex: 1; padding: 10px 12px; font-size: 14px; color: var(--gd-ink); background: transparent; outline: none; }

/* Disclosures */
.gd-disclosures { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.gd-disclosure { border: 1.5px solid var(--gd-border); border-radius: 10px; background: #fff; overflow: hidden; }
.gd-disclosure-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px;
  cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--gd-ink);
  list-style: none;
}
.gd-disclosure-summary::-webkit-details-marker { display: none; }
.gd-disclosure-icon { font-size: 14px; }
.gd-badge-applied { margin-left: auto; font-size: 11px; background: #dcfce7; color: var(--gd-green); padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.gd-disclosure-body { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.gd-addon-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
.gd-addon-info { display: flex; flex-direction: column; gap: 2px; }
.gd-addon-name { font-size: 13px; font-weight: 600; color: var(--gd-ink); }
.gd-addon-desc { font-size: 11px; color: var(--gd-faint); }
.gd-addon-price { font-size: 11px; color: var(--gd-coral); }
.gd-counter { display: flex; align-items: center; gap: 6px; }
.gd-counter-btn { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid var(--gd-border); background: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.gd-counter-val { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }

/* Consent */
.gd-consent-box { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1.5px solid var(--gd-border); border-radius: 10px; background: #fafafa; margin-bottom: 16px; }
.gd-consent-row { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
.gd-check { width: 16px; height: 16px; margin-top: 2px; accent-color: #6366f1; }
.gd-consent-text { font-size: 12px; color: var(--gd-ink); line-height: 1.5; }
.gd-consent-text--muted { color: var(--gd-faint); }
.gd-consent-badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .08em; color: var(--gd-coral); background: #fef2f2; padding: 1px 6px; border-radius: 3px; vertical-align: middle; }
.gd-link { color: var(--gd-coral); text-decoration: underline; }

/* Error banners */
.gd-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
.gd-banner--error { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
.gd-banner--info { background: #fff7ed; border: 1px solid #fed7aa; color: #7c2d12; }
.gd-banner-icon { font-size: 14px; flex-shrink: 0; }
.gd-banner-cta { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--gd-coral); background: none; border: none; cursor: pointer; white-space: nowrap; text-decoration: underline; }

/* Aside */
.gd-aside { position: sticky; top: calc(var(--nav-height) + 52px); }
.gd-price-card { background: #fff; border: 1.5px solid var(--gd-border); border-radius: 14px; padding: 20px; margin-bottom: 16px; }
.gd-price-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.gd-price-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--gd-ink); }
.gd-price-row--sub { color: var(--gd-faint); font-size: 12px; padding-left: 12px; }
.gd-price-row--discount { color: var(--gd-green); }
.gd-price-total { display: flex; justify-content: space-between; font-size: 17px; font-weight: 700; color: var(--gd-ink); padding-top: 12px; border-top: 1.5px solid var(--gd-border); }
.gd-price-micro { font-size: 11px; color: var(--gd-faint); margin-top: 8px; line-height: 1.4; }

/* Trust band */
.gd-trust { display: flex; flex-direction: column; gap: 6px; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; margin-bottom: 16px; font-size: 12px; color: #166534; }
.gd-trust-row { line-height: 1.4; }

/* Pay CTA */
.gd-pay {
  width: 100%;
  padding: 14px;
  background: var(--gd-coral);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: opacity .15s;
}
.gd-pay:hover:not(:disabled) { opacity: .92; }
.gd-pay:disabled { opacity: .55; cursor: not-allowed; }

/* Mobile sticky bar */
.gd-mobile-bar {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 40;
  background: #fff;
  border-top: 1.5px solid var(--gd-border);
  padding: 12px 16px;
  gap: 12px;
  align-items: center;
}
@media (max-width: 768px) { .gd-mobile-bar { display: flex; } }
.gd-mobile-bar-left { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.gd-mobile-timer { font-size: 11px; color: var(--gd-amber); font-weight: 600; }
.gd-mobile-total { font-size: 16px; font-weight: 700; color: var(--gd-ink); }
.gd-mobile-pay {
  padding: 11px 20px;
  background: var(--gd-coral);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
}
.gd-mobile-pay:disabled { opacity: .55; cursor: not-allowed; }

/* Expired modal */
.gd-modal-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.gd-modal {
  background: #fff; border-radius: 16px; padding: 32px 28px;
  max-width: 400px; width: 100%; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,.15);
}
.gd-modal-icon { font-size: 40px; margin-bottom: 12px; }
.gd-modal-title { font-size: 20px; font-weight: 700; color: var(--gd-ink); margin: 0 0 10px; }
.gd-modal-body { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px; }
.gd-modal-cta {
  display: block; width: 100%;
  padding: 13px; background: var(--gd-coral); color: #fff;
  font-size: 15px; font-weight: 700; border: none; border-radius: 10px; cursor: pointer;
}
`;

export default GuestDetailsPage;
