/**
 * TASK-2612: GuestDetailsPage — step 2 of the two-step booking flow.
 *
 * Receives holdId + holdExpiresAt from BookingContext (set by UnitBookingWidget Reserve).
 * Collects guest PII, submits final-charge POST /api/Razorpay/order, opens Razorpay modal.
 *
 * Visual: matches Claude Design bundle (post-reserve-checkout) exactly.
 * CSS: .gd-* tokens verbatim from styles.css in bundle.
 * Copy: verbatim from handoff.jsx CopyTable.
 * Icons: inline SVGs from icons.jsx in bundle.
 * Layout: desktop two-col (560px + 380px), mobile sticky header + pay bar.
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
import { useBooking, type BookingPriceBreakdown } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import {
  clampNationalDigits,
  getGuestDialOption,
  GUEST_DIAL_OPTIONS,
  toGuestPhoneE164,
  toRazorpayContactDigits,
} from '@/utils/guestPhoneDial';
import { getTenantContext } from '@/tenant/tenantContext';
import { getGuestDataProcessingEntityName, getTenantBrandName } from '@/tenant/displayBrand';
import { formatCurrency } from '@/utils/formatting';
import { formatDateInTimezone } from '@/utils/dateHelpers';
import { track } from '@/lib/events';
import { mapRazorpayFailureCode } from '@/utils/razorpayGuestErrors';
import { formatDisplayNumber, getContactEmail, getTelLink, getWhatsAppLink } from '@/config/contact';
import { computeCheckoutTotal } from '@/utils/guestPriceEstimate';
import {
  buildRazorpayCheckoutDisplayConfig,
  isMobileCheckoutUserAgent,
} from '@/utils/razorpayCheckoutOptions';
import {
  resolveFreeCancellationTrustCopy,
  type FreeCancellationTrustCopy,
} from '@/utils/cancellationPolicy';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/** TASK-5183: fire-and-forget hard-delete of PaymentPending draft when checkout is abandoned. */
function abandonPaymentPendingCheckout(
  bookingId: number | null | undefined,
  token: string | null | undefined,
): void {
  if (!bookingId || bookingId <= 0) return;
  const t = typeof token === 'string' ? token.trim() : '';
  if (!t) return;
  const url = buildApiUrl(
    `/api/guest/bookings/${bookingId}/abandon-checkout?t=${encodeURIComponent(t)}`,
  );
  try {
    void fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      keepalive: true,
    });
  } catch {
    /* fire-and-forget — TTL worker is the backstop */
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

const ADD_ON_MAX_QTY = 5;

function addOnLineTotal(
  ao: AddOnService,
  qty: number,
  stayNights: number,
  guestCount: number,
): number {
  if (qty <= 0) return 0;
  const type = (ao.priceType || 'per_stay').toLowerCase().replace(/-/g, '_');
  const unit = ao.price * qty;
  if (type.includes('night')) return unit * Math.max(1, stayNights);
  if (type.includes('guest')) return unit * Math.max(1, guestCount);
  return unit;
}

function addOnPriceHint(priceType: string, stayNights: number, guestCount: number): string {
  const type = (priceType || 'per_stay').toLowerCase();
  if (type.includes('night')) return `× ${Math.max(1, stayNights)} night${stayNights === 1 ? '' : 's'}`;
  if (type.includes('guest')) return `× ${Math.max(1, guestCount)} guest${guestCount === 1 ? '' : 's'}`;
  return 'per stay';
}

// ── Inline SVG icons (verbatim from bundle icons.jsx) ─────────────────────

const IconChevronDown = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
);
const IconChevronLeft = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
);
const IconLock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const IconClock = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconCheck = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconWhatsApp = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.7-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2 0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.5 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.7.1.5-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3a8.3 8.3 0 1 1 6.9 3.7z"/></svg>
);
const IconAlert = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
const IconEdit = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const IconSpinner = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: 'gd-spin 0.9s linear infinite' }}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);
const IconTag = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
);
const IconGift = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
);
const IconSparkles = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z"/><path d="M19 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/></svg>
);
const IconNote = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="14" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>
);

// ── Utilities ─────────────────────────────────────────────────────────────────

const LAST_UPI_VPA_KEY = 'atlas_last_upi_vpa';
const CHECKOUT_DRAFT_KEY = 'atlas_guest_checkout_draft';
/** TASK-2882: survive hard reload on GuestDetailsPage with a still-valid server hold. */
const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';
/** TASK-4296, TASK-4432: must match the API's CheckoutHoldConstants.HoldMinutes (15). Drives both the
 *  countdown progress baseline and the hold-expiry copy so they agree on the real duration. */
const CHECKOUT_HOLD_MINUTES = 15;

type CheckoutHoldCache = {
  holdId: number;
  holdExpiresAt: string;
  holdToken?: string | null;
  holdListingId?: number | null;
  holdPropertySlug?: string | null;
  holdUnitSlug?: string | null;
  holdListingName?: string | null;
  holdPriceBreakdown?: BookingPriceBreakdown | null;
  holdCancellationTier?: 'Flexible' | 'Moderate' | 'Strict' | null;
  holdCancellationWindowHours?: number | null;
  holdGraceHours?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
};

function loadCheckoutHold(): CheckoutHoldCache | null {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_HOLD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutHoldCache;
    if (!parsed?.holdId || !parsed?.holdExpiresAt) return null;
    if (new Date(parsed.holdExpiresAt).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Guest PII typed on this page, persisted to sessionStorage so a reload/Back doesn't lose it. */
type CheckoutDraft = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  notes: string;
  phoneDialCode: string;
};

function loadCheckoutDraft(): Partial<CheckoutDraft> {
  try {
    const saved = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    return saved ? (JSON.parse(saved) as Partial<CheckoutDraft>) : {};
  } catch {
    return {};
  }
}

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function remainingPct(expiresAt: string, ttlMs = CHECKOUT_HOLD_MINUTES * 60 * 1000): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.min(1, ms / ttlMs));
}

function loadRazorpayScript(onSuccess: () => void, onError: (msg: string) => void) {
  if (window.Razorpay) { onSuccess(); return; }

  let timeoutId: NodeJS.Timeout | null = null;
  let alreadyFired = false;

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  const handleSuccess = () => {
    if (alreadyFired) return;
    alreadyFired = true;
    cleanup();
    onSuccess();
  };

  const handleError = (msg: string) => {
    if (alreadyFired) return;
    alreadyFired = true;
    cleanup();
    onError(msg);
  };

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => {
    if (!window.Razorpay) {
      handleError('Razorpay SDK loaded but failed to initialize.');
      return;
    }
    handleSuccess();
  };
  script.onerror = () => handleError('Failed to load Razorpay checkout script.');
  document.head.appendChild(script);

  // 10-second timeout safety
  timeoutId = setTimeout(() => {
    handleError('Razorpay script loading timed out. Please check your connection and try again.');
  }, 10000);
}

// ── GuestDetailsPage ─────────────────────────────────────────────────────────

const GuestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { propertySlug, unitSlug } = useParams<{ propertySlug: string; unitSlug: string }>();
  const { booking, updateBooking } = useBooking();
  const brandName = getTenantBrandName();
  const { currency, formatINR } = useCurrency();
  const [holdHydrationDone, setHoldHydrationDone] = useState(false);

  // TASK-2882: rehydrate hold from sessionStorage after hard reload before showing "pick dates" modal.
  useEffect(() => {
    if (!booking.holdId || !booking.holdExpiresAt) {
      const cached = loadCheckoutHold();
      if (cached) {
        updateBooking({
          holdId: cached.holdId,
          holdExpiresAt: cached.holdExpiresAt,
          holdToken: cached.holdToken ?? null,
          holdListingId: cached.holdListingId ?? null,
          holdPropertySlug: cached.holdPropertySlug ?? null,
          holdUnitSlug: cached.holdUnitSlug ?? null,
          holdListingName: cached.holdListingName ?? null,
          holdPriceBreakdown: cached.holdPriceBreakdown ?? null,
          holdCancellationTier: cached.holdCancellationTier ?? null,
          holdCancellationWindowHours: cached.holdCancellationWindowHours ?? null,
          holdGraceHours: cached.holdGraceHours ?? null,
          checkIn: cached.checkIn ?? null,
          checkOut: cached.checkOut ?? null,
          guests: cached.guests ?? booking.guests,
        });
      }
    }
    setHoldHydrationDone(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only rehydrate

  // ── Hold state from context ──────────────────────────────────────────────
  const holdId = booking.holdId;
  const holdToken = booking.holdToken;
  const holdExpiresAt = booking.holdExpiresAt;
  const holdListingId = booking.holdListingId;
  const priceBreakdown = booking.holdPriceBreakdown;

  // No hold state (direct navigation or hard reload): instead of a silent redirect,
  // we render a "pick your dates again" card (see early return in Render) and keep the
  // guest's typed details, which are persisted to sessionStorage below.

  // ── Hold countdown ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(() =>
    holdExpiresAt ? formatCountdown(holdExpiresAt) : '0:00',
  );
  const [holdPct, setHoldPct] = useState(() =>
    holdExpiresAt ? remainingPct(holdExpiresAt) : 0,
  );
  const [holdExpired, setHoldExpired] = useState(false);

  // TASK-4439: focus management for the blocking hold dialogs (WCAG 2.4.3 / 2.1.2)
  const noHoldDialogRef = useFocusTrap<HTMLDivElement>(
    holdHydrationDone && (!holdId || !holdExpiresAt),
  );
  const expiredDialogRef = useFocusTrap<HTMLDivElement>(holdExpired);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const remaining = new Date(holdExpiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('0:00');
        setHoldPct(0);
        setHoldExpired(true);
        return;
      }
      setCountdown(formatCountdown(holdExpiresAt));
      setHoldPct(remainingPct(holdExpiresAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [phoneDialCode, setPhoneDialCode] = useState(() => {
    const draft = loadCheckoutDraft();
    return typeof draft.phoneDialCode === 'string'
      && GUEST_DIAL_OPTIONS.some((o) => o.code === draft.phoneDialCode)
      ? draft.phoneDialCode
      : GUEST_DIAL_OPTIONS[0].code;
  });
  const [formData, setFormData] = useState(() => {
    const draft = loadCheckoutDraft();
    return {
      name: typeof draft.name === 'string' ? draft.name : '',
      email: typeof draft.email === 'string' ? draft.email : '',
      phone: typeof draft.phone === 'string' ? draft.phone : '',
      nationality: typeof draft.nationality === 'string' && draft.nationality ? draft.nationality : 'India',
      notes: typeof draft.notes === 'string' ? draft.notes : '',
    };
  });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [consentFlash, setConsentFlash] = useState(false);
  const consentRowRef = useRef<HTMLDivElement>(null);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true); // transactional_whatsapp — pre-checked per spec
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Persist guest PII to sessionStorage so a hard reload / Back nav doesn't lose it.
  // Consent is intentionally NOT persisted — DPDP consent must be actively given each session.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ ...formData, phoneDialCode }),
      );
    } catch { /* ignore */ }
  }, [formData, phoneDialCode]);

  useEffect(() => {
    if (!holdId || !holdExpiresAt) {
      try { window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY); } catch { /* ignore */ }
      return;
    }
    const payload: CheckoutHoldCache = {
      holdId: Number(holdId),
      holdExpiresAt,
      holdToken: holdToken ?? null,
      holdListingId: holdListingId ?? null,
      holdPropertySlug: booking.holdPropertySlug ?? propertySlug ?? null,
      holdUnitSlug: booking.holdUnitSlug ?? unitSlug ?? null,
      holdListingName: booking.holdListingName ?? null,
      holdPriceBreakdown: priceBreakdown ?? null,
      holdCancellationTier: booking.holdCancellationTier ?? null,
      holdCancellationWindowHours: booking.holdCancellationWindowHours ?? null,
      holdGraceHours: booking.holdGraceHours ?? null,
      checkIn: booking.checkIn ?? null,
      checkOut: booking.checkOut ?? null,
      guests: booking.guests,
    };
    try {
      window.sessionStorage.setItem(CHECKOUT_HOLD_KEY, JSON.stringify(payload));
    } catch { /* ignore */ }
  }, [
    holdId, holdToken, holdExpiresAt, holdListingId, priceBreakdown, booking.checkIn, booking.checkOut,
    booking.guests, booking.holdPropertySlug, booking.holdUnitSlug, booking.holdListingName,
    booking.holdCancellationTier, booking.holdCancellationWindowHours, booking.holdGraceHours,
    propertySlug, unitSlug,
  ]);

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
  /** TASK-2880: true once `/api/Razorpay/order` returned the authoritative promo discount. */
  const [serverPromoLocked, setServerPromoLocked] = useState(false);

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

  const stayGuestCount = booking.guests ?? 1;

  // ── Pricing ───────────────────────────────────────────────────────────────
  const baseAmount = priceBreakdown?.baseAmount ?? 0;
  const globalDiscountAmount = priceBreakdown?.discountAmount ?? 0;
  const convenienceFeeAmount = priceBreakdown?.convenienceFeeAmount ?? 0;
  const nights = priceBreakdown?.nights ?? 0;

  const addOnsTotal = useMemo(
    () =>
      availableAddOns.reduce((sum, ao) => {
        const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
        return sum + addOnLineTotal(ao, qty, nights, stayGuestCount);
      }, 0),
    [availableAddOns, selectedAddOns, nights, stayGuestCount],
  );
  // cleaningFeeAmount not in BookingPriceBreakdown — convenienceFee covers cleaning + service combined
  const cleaningFeeAmount = 0;

  const displayPrice = (n: number) => formatCurrency(n, { maximumFractionDigits: 0 });

  // TASK-4831: prefer the server-authoritative hold `finalAmount` (base − discount + GST + convenience
  // fee — the same figure the listing widget shows and RazorpayPaymentService charges) over a client-side
  // GST-slab recompute, which diverges from the server near the ₹7,500/night slab boundary and made the
  // /details total disagree with the widget and the Razorpay order until the "tap Pay again" gate.
  // The GST line is backed out of `finalAmount` so the displayed line items reconcile with the total;
  // add-ons / promo / referral (applied only at the final-charge step) are layered on top.
  // TASK-4421: global discount still applies before GST; the slab decision uses the post-discount base.
  const serverFinalAmount =
    typeof priceBreakdown?.finalAmount === 'number' && priceBreakdown.finalAmount > 0
      ? priceBreakdown.finalAmount
      : null;
  const touristTaxAmount =
    typeof priceBreakdown?.touristTaxAmount === 'number' && priceBreakdown.touristTaxAmount > 0
      ? priceBreakdown.touristTaxAmount
      : 0;
  // TASK-5204: client-side promo validate is advisory only — subtract from the total once
  // `/api/Razorpay/order` echoes the authoritative discount (`serverPromoLocked`).
  const confirmedPromoDiscount = serverPromoLocked ? promoDiscountAmount : 0;

  const { perNight, gstSlabPercent, gstLineAmount, displayTotal } =
    computeCheckoutTotal({
      baseAmount,
      globalDiscountAmount,
      convenienceFeeAmount,
      nights,
      serverFinalAmount,
      touristTaxAmount,
      addOnsTotal,
      promoDiscountAmount: confirmedPromoDiscount,
      referralDiscountAmount,
    });

  // ── Check-in/out display ─────────────────────────────────────────────────
  const checkInDisplay = booking.checkIn
    ? formatDateInTimezone(new Date(booking.checkIn), 'Asia/Kolkata')
    : '—';
  const checkOutDisplay = booking.checkOut
    ? formatDateInTimezone(new Date(booking.checkOut), 'Asia/Kolkata')
    : '—';
  // propertyName: prefer booking.propertyName (set by BookingContext), fallback to deriving from slug
  const propertyName = booking.propertyName ?? (propertySlug ? propertySlug.replace(/-/g, ' ') : '');
  // TASK-2623: prefer holdListingName (the actual listing name passed from UnitBookingWidget);
  // fall back to unitSlug-derived display only when holdListingName is unavailable.
  // When unitSlug is purely numeric (e.g. "5"), skip the slug→name fallback entirely.
  const unitName = booking.holdListingName?.trim()
    || (unitSlug && /\D/.test(unitSlug) ? unitSlug.replace(/-/g, ' ') : unitSlug ?? '');

  // TASK-5179: free-cancellation deadline from resolved listing policy (not a hardcoded 48h).
  const freeCancellationCopy = useMemo(() => {
    if (!booking.checkIn) return null;
    return resolveFreeCancellationTrustCopy({
      checkInDate: new Date(booking.checkIn),
      tier: booking.holdCancellationTier,
      windowHoursOverride: booking.holdCancellationWindowHours,
      bookingCreatedAt: new Date(),
      graceHours: booking.holdGraceHours,
    });
  }, [
    booking.checkIn,
    booking.holdCancellationTier,
    booking.holdCancellationWindowHours,
    booking.holdGraceHours,
  ]);

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderErrorIs409, setOrderErrorIs409] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayAmountPaise, setRazorpayAmount] = useState<number | null>(null);
  const pendingBookingTokenRef = useRef<string | null>(null);
  // TASK-4536: Track the stable idempotency key for the current attempt so retries reuse it.
  const currentAttemptIdempotencyKeyRef = useRef<string | null>(null);
  // TASK-4537: Track the poll timer so we can clear it on unmount.
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chargedUnconfirmedPollTriesRef = useRef(0);
  const [chargedUnconfirmedPollExhausted, setChargedUnconfirmedPollExhausted] = useState(false);
  const [chargedUnconfirmedChecking, setChargedUnconfirmedChecking] = useState(false);
  const chargedUnconfirmedBookingRef = useRef<{ bookingId: number; pollToken: string | null } | null>(null);
  /** TASK-2875: when server total differs from the client quote, require a second Pay tap before Razorpay opens. */
  const [serverTotalConfirmRequired, setServerTotalConfirmRequired] = useState(false);
  const pendingRazorpayLaunchRef = useRef<{
    keyId: string;
    orderId: string;
    bookingId: number;
    amount: number;
    bookingToken: string | null;
    idempotencyKey: string; // TASK-4536: stable key for retry/resume deduplication
  } | null>(null);
  const serverTotalWarnRef = useRef<HTMLDivElement>(null);

  // TASK-2875: scroll the server-total warning into view once a second-tap confirm becomes required.
  // Declared here (after serverTotalConfirmRequired/serverTotalWarnRef) to avoid a used-before-declaration / TDZ error.
  useEffect(() => {
    if (serverTotalConfirmRequired) {
      serverTotalWarnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [serverTotalConfirmRequired]);

  // TASK-4536: Invalidate the pending order when cart contents change (add-ons, promo, referral).
  // If a cart edit happens after "Total updated — tap Pay again" gate, the next Pay tap must
  // create a fresh order at the new total, not reuse the stale order/amount.
  // TASK-4607: Also clear the idempotency key so the next attempt doesn't reuse a stale key
  // with a changed payload, which would cause a 409 "different payload" error.
  useEffect(() => {
    pendingRazorpayLaunchRef.current = null;
    currentAttemptIdempotencyKeyRef.current = null;
    setServerTotalConfirmRequired(false);
  }, [selectedAddOns, promoCode, referralCode]);

  // TASK-4537: Clear poll timers on unmount so late navigate() doesn't yank the guest off their page.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  /** TASK-2875: when the server total differs, the Pay CTA shows the authoritative charge (INR). */
  const chargeInr =
    serverTotalConfirmRequired && razorpayAmountPaise != null && razorpayAmountPaise > 0
      ? razorpayAmountPaise / 100
      : displayTotal;

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
    if (!valid) {
      requestAnimationFrame(() => {
        // Focus and scroll to first failing field (WCAG 3.3 error identification)
        if (errors.name) {
          const el = document.getElementById('gd-name');
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (errors.email) {
          const el = document.getElementById('gd-email');
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (errors.phone) {
          const el = document.getElementById('gd-phone');
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (!consentAccepted) {
          consentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          consentRowRef.current?.focus();
        }
      });
    }
    return valid;
  }, [formData, phoneDialCode, consentAccepted]);

  // ── Promo blur handler ────────────────────────────────────────────────────
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
        setServerPromoLocked(false);
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
    if (!code) {
      setReferralMessage(null);
      if (referralDiscountAmount <= 0) setAppliedReferralCode(null);
      return;
    }
    setReferralValidating(true);
    setTimeout(() => {
      if (/^[A-Z0-9]{1,32}$/.test(code)) {
        // TASK-5201: format-only check — server validates eligibility at checkout; no fake "Applied" state.
        if (referralDiscountAmount <= 0) setAppliedReferralCode(null);
        setReferralMessage('We\'ll verify this code when you pay.');
      } else {
        setAppliedReferralCode(null);
        setReferralMessage('Referral codes must be letters and numbers only (no spaces or symbols).');
      }
      setReferralValidating(false);
    }, 300);
  }, [referralCode, referralDiscountAmount]);

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
      setOrderErrorIs409(false);
      setPaymentCancelled(false);

      const dial = getGuestDialOption(phoneDialCode);
      const e164Phone = toGuestPhoneE164(phoneDialCode, clampNationalDigits(formData.phone, dial.maxDigits));

      const selectedAddOnsList = availableAddOns
        .filter((ao) => (selectedAddOns[ao.addOnServiceId] ?? 0) > 0)
        .map((ao) => ({ addOnServiceId: ao.addOnServiceId, quantity: selectedAddOns[ao.addOnServiceId] }));

      const payload = {
        holdId: numericHoldId,
        // TASK-4354: prove ownership of the hold — server rejects a guessed holdId without this token.
        holdToken: holdToken ?? undefined,
        currency: 'INR',
        guestConsentAccepted: consentAccepted,
        guestPurposeConsents: {
          booking_contact: consentAccepted,
          transactional_whatsapp: whatsappOptIn,
          marketing: marketingOptIn,
        },
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
        const numericListingId = holdListingId ? Number(holdListingId) : 0;
        let keyId: string;
        let orderId: string;
        let bookingId: number;
        let amount: number;
        let bookingToken: string | null = null;
        let idempotencyKey: string;

        const pendingLaunch = pendingRazorpayLaunchRef.current;
        if (pendingLaunch) {
          pendingRazorpayLaunchRef.current = null;
          setServerTotalConfirmRequired(false);
          ({ keyId, orderId, bookingId, amount, bookingToken, idempotencyKey } = pendingLaunch);
          currentAttemptIdempotencyKeyRef.current = idempotencyKey;
          pendingBookingTokenRef.current = bookingToken;
          setRazorpayOrderId(orderId);
          setRazorpayAmount(amount);
        } else {
          // TASK-4536: Generate stable idempotency key for this attempt (same key across retries).
          let idempotencyKey = currentAttemptIdempotencyKeyRef.current;
          if (!idempotencyKey) {
            idempotencyKey = crypto.randomUUID();
            currentAttemptIdempotencyKeyRef.current = idempotencyKey;
          }
          track('start_checkout', numericListingId);

          const response = await axios.post(buildApiUrl('/api/Razorpay/order'), payload, {
            headers: getOrderRequestHeaders(idempotencyKey),
            timeout: 20000,
          });
          const responseData = response.data;

          const {
            keyId: respKeyId,
            orderId: respOrderId,
            bookingId: respBookingId,
            bookingToken: respBookingToken,
            amount: respAmount,
            appliedReferralCode: serverReferralCode,
            referralDiscountAmount: serverReferralDiscount,
            appliedPromoCode: serverPromoCode,
            promoDiscountAmount: serverPromoDiscount,
          } = responseData ?? {};

          if (!respKeyId || typeof respKeyId !== 'string') {
            throw new Error('Checkout error: missing payment key. Please try again.');
          }
          if (!respOrderId || typeof respOrderId !== 'string') {
            throw new Error('Checkout error: missing order ID from backend. Please try again.');
          }
          if (!respBookingId || (typeof respBookingId !== 'number' && typeof respBookingId !== 'string')) {
            throw new Error('Checkout error: missing booking ID. Please try again.');
          }
          if (!respAmount || typeof respAmount !== 'number' || respAmount <= 0) {
            console.error('[GuestDetailsPage] Invalid amount:', respAmount);
            throw new Error('Checkout error: invalid payment amount. Please try again.');
          }

          if (typeof serverReferralCode === 'string' && serverReferralCode.trim()) {
            setAppliedReferralCode(serverReferralCode.trim());
            setReferralDiscountAmount(Number(serverReferralDiscount) > 0 ? Number(serverReferralDiscount) : 0);
          }
          if (typeof serverPromoCode === 'string' && serverPromoCode.trim()) {
            setAppliedPromoCode(serverPromoCode.trim());
            setPromoDiscountAmount(Number(serverPromoDiscount) > 0 ? Number(serverPromoDiscount) : 0);
            setServerPromoLocked(true);
            if (!(Number(serverPromoDiscount) > 0)) {
              setPromoMessage(`Promo ${serverPromoCode.trim()} could not be applied`);
              setPromoOpen(true);
            }
          } else if (Number(serverPromoDiscount) > 0) {
            setServerPromoLocked(true);
          } else if (appliedPromoCode && promoDiscountAmount > 0) {
            setPromoDiscountAmount(0);
            setAppliedPromoCode(null);
            setServerPromoLocked(true);
            setPromoMessage(`Promo ${appliedPromoCode} could not be applied`);
            setPromoOpen(true);
          }

          // TASK-4967: mirror the promo rejection branch above — a referral code that
          // the server rejects (or silently drops the discount for) must not fail silently.
          if (typeof serverReferralCode === 'string' && serverReferralCode.trim()) {
            setAppliedReferralCode(serverReferralCode.trim());
            setReferralDiscountAmount(Number(serverReferralDiscount) > 0 ? Number(serverReferralDiscount) : 0);
            if (!(Number(serverReferralDiscount) > 0)) {
              setReferralMessage(`Referral ${serverReferralCode.trim()} could not be applied`);
              setReferralOpen(true);
            }
          } else if (Number(serverReferralDiscount) > 0) {
            // discount present without an echoed code — nothing to correct.
          } else if (appliedReferralCode && referralDiscountAmount > 0) {
            setReferralDiscountAmount(0);
            setAppliedReferralCode(null);
            setReferralMessage(`Referral ${appliedReferralCode} could not be applied`);
            setReferralOpen(true);
          }

          keyId = respKeyId;
          orderId = respOrderId;
          bookingId = Number(respBookingId);
          amount = Number(respAmount);
          bookingToken = typeof respBookingToken === 'string' ? respBookingToken.trim() : null;

          setRazorpayOrderId(orderId);
          setRazorpayAmount(amount);
          pendingBookingTokenRef.current = bookingToken;

          const clientQuotePaise = Math.round(displayTotal * 100);
          if (Math.abs(amount - clientQuotePaise) > 100) {
            pendingRazorpayLaunchRef.current = {
              keyId,
              orderId,
              bookingId,
              amount,
              bookingToken,
              idempotencyKey, // TASK-4536: stash the idempotency key so retries reuse it
            };
            setServerTotalConfirmRequired(true);
            setIsSubmitting(false);
            return;
          }
        }

        loadRazorpayScript(
          () => {
            // Script loaded successfully, initialize Razorpay
            try {
              let paymentCompleted = false;

              let lastUpiVpa = '';
              try { lastUpiVpa = localStorage.getItem(LAST_UPI_VPA_KEY)?.trim() ?? ''; } catch { /* ignore */ }

              const isMobileCheckout = isMobileCheckoutUserAgent(
                typeof navigator !== 'undefined' ? navigator.userAgent : '',
              );
              const checkoutDisplay = buildRazorpayCheckoutDisplayConfig(lastUpiVpa, isMobileCheckout);

              const handleClose = () => {
                if (paymentCompleted) return;
                paymentCompleted = true;
                // TASK-5183: release inventory when the guest dismisses Razorpay without paying.
                abandonPaymentPendingCheckout(bookingId, bookingToken ?? pendingBookingTokenRef.current);
                setIsSubmitting(false);
                setPaymentCancelled(true);
                setRazorpayOrderId(null);
              };

              const options = {
                key: keyId,
                amount: Number(amount),
                currency: 'INR',
                name: getTenantContext()?.displayMerchantName ?? brandName,
                description: `Booking confirmation`,
                order_id: orderId,
                prefill: {
                  name: formData.name.trim(),
                  email: formData.email.trim(),
                  contact: toRazorpayContactDigits(
                    phoneDialCode,
                    clampNationalDigits(formData.phone, dial.maxDigits),
                  ),
                  ...checkoutDisplay.prefillExtras,
                },
                ...(checkoutDisplay.upi ? { upi: checkoutDisplay.upi } : {}),
                config: checkoutDisplay.config,
                theme: { color: '#b8472f' },
                modal: { ondismiss: handleClose },
                handler: async (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                  paymentCompleted = true;
                  try {
                    const verifyBody = {
                      bookingId: Number(bookingId),
                      razorpayOrderId: res.razorpay_order_id,
                      razorpayPaymentId: res.razorpay_payment_id,
                      razorpaySignature: res.razorpay_signature,
                      guestInfo: {
                        name: formData.name.trim(),
                        email: formData.email.trim(),
                        phone: e164Phone,
                      },
                    };
                    let verifyRes: { data?: { success?: boolean; message?: string; lastUpiVpa?: string } } | null = null;
                    for (let attempt = 0; attempt < 2; attempt++) {
                      try {
                        verifyRes = await axios.post(
                          buildApiUrl('/api/Razorpay/verify'),
                          verifyBody,
                          { headers: { ...getApiHeaders(), 'Content-Type': 'application/json' }, timeout: 15000 },
                        );
                        if (verifyRes?.data?.success) break;
                      } catch (verifyErr) {
                        if (attempt === 1) throw verifyErr;
                        await new Promise((r) => setTimeout(r, 800));
                      }
                    }
                    if (verifyRes?.data?.success) {
                      const vpa = typeof verifyRes.data.lastUpiVpa === 'string' ? verifyRes.data.lastUpiVpa.trim() : '';
                      if (vpa) { try { localStorage.setItem(LAST_UPI_VPA_KEY, vpa); } catch { /* ignore */ } }
                      try {
                        localStorage.setItem('atlas_guest_email', formData.email.trim());
                        if (formData.name.trim()) localStorage.setItem('atlas_guest_name', formData.name.trim());
                        if (e164Phone) localStorage.setItem('atlas_guest_phone', e164Phone);
                      } catch { /* ignore */ }
                      try {
                        sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
                        sessionStorage.removeItem(CHECKOUT_HOLD_KEY);
                      } catch { /* ignore */ }
                      // TASK-4536: Clear the attempt's idempotency key on successful payment.
                      currentAttemptIdempotencyKeyRef.current = null;
                      updateBooking({
                        holdId: null, holdExpiresAt: null, holdPropertySlug: null,
                        holdUnitSlug: null, holdPriceBreakdown: null, holdListingId: null,
                        holdListingName: null, holdCancellationTier: null,
                        holdCancellationWindowHours: null, holdGraceHours: null,
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
                      throw new Error(verifyRes?.data?.message || 'Payment verification failed.');
                    }
                  } catch (err) {
                    console.error('[GuestDetailsPage] verify error:', err);
                    const paymentId = res.razorpay_payment_id;
                    const waText = encodeURIComponent(
                      `Hi, my payment succeeded but booking verification failed. Payment ID: ${paymentId}. Booking ID: ${bookingId}.`,
                    );
                    // TASK-5207: Poll booking-summary for up to ~5 minutes; offer manual re-check when exhausted.
                    setChargedUnconfirmedPollExhausted(false);
                    chargedUnconfirmedPollTriesRef.current = 0;
                    chargedUnconfirmedBookingRef.current = { bookingId, pollToken: pendingBookingTokenRef.current };
                    setOrderError(
                      `Payment received but we could not confirm your booking yet. Payment ID: ${paymentId} · Booking #${bookingId}. ` +
                        `We will retry automatically for about 5 minutes — if your stay is not confirmed by then, tap "Check again" below or contact us on WhatsApp (${getWhatsAppLink()}?text=${waText}) ` +
                        `or email ${getContactEmail()}. No need to pay again.`,
                    );
                    const pollToken = pendingBookingTokenRef.current;
                    const pollStatus = async () => {
                      chargedUnconfirmedPollTriesRef.current += 1;
                      try {
                        const r = await fetch(
                          buildApiUrl(`/api/guest/bookings/${bookingId}/summary?t=${encodeURIComponent(pollToken ?? '')}`),
                          { headers: { Accept: 'application/json', ...getApiHeaders() } },
                        );
                        if (r.ok) {
                          const d: { status?: string } = await r.json();
                          const s = d?.status;
                          if (s === 'Confirmed' || s === 'CheckedIn' || s === 'PaymentReceived') {
                            pollTimerRef.current = null;
                            setChargedUnconfirmedPollExhausted(false);
                            navigate(
                              pollToken ? `/booking/${bookingId}?t=${encodeURIComponent(pollToken)}` : `/booking/${bookingId}`,
                              { replace: true },
                            );
                            return;
                          }
                        }
                      } catch { /* ignore, keep polling */ }
                      if (chargedUnconfirmedPollTriesRef.current < 20) {
                        pollTimerRef.current = setTimeout(pollStatus, 15000);
                      } else {
                        pollTimerRef.current = null;
                        setChargedUnconfirmedPollExhausted(true);
                      }
                    };
                    pollTimerRef.current = setTimeout(pollStatus, 15000);
                  } finally {
                    setIsSubmitting(false);
                  }
                },
              };

              // TASK-4541: gate opening Razorpay if hold has expired or insufficient time remains
              if (holdExpired) {
                throw new Error('Hold expired — please re-select your dates.');
              }
              if (holdExpiresAt) {
                const remainingMs = new Date(holdExpiresAt).getTime() - Date.now();
                // Require ≥ 30 seconds remaining to open checkout (guest has time to pay)
                if (remainingMs < 30000) {
                  throw new Error(`Hold expires in ${Math.ceil(remainingMs / 1000)} seconds — please re-select your dates to avoid an interruption during payment.`);
                }
              }

              if (!window.Razorpay) {
                throw new Error('Razorpay SDK is not available. Please refresh and try again.');
              }

              type RazorpayCheckout = {
                open: () => void;
                on: (event: string, handler: (r: unknown) => void) => void;
              };
              const rzp = new window.Razorpay(options) as RazorpayCheckout;

              // TASK-4541: monitor hold expiry while payment modal is open and close on expiry
              const expireCheckInterval = setInterval(() => {
                if (holdExpired || !holdExpiresAt) {
                  clearInterval(expireCheckInterval);
                  if (holdExpired && !paymentCompleted) {
                    paymentCompleted = true;
                    setOrderError('Hold expired while payment was in progress. Please re-select your dates and try again.');
                    setIsSubmitting(false);
                  }
                  return;
                }
                const remainingMs = new Date(holdExpiresAt).getTime() - Date.now();
                if (remainingMs <= 0 && !paymentCompleted) {
                  clearInterval(expireCheckInterval);
                  paymentCompleted = true;
                  setOrderError('Hold expired while payment was in progress. Please re-select your dates and try again.');
                  setIsSubmitting(false);
                }
              }, 1000);

              rzp.on('payment.failed', (failRes: unknown) => {
                clearInterval(expireCheckInterval);
                paymentCompleted = true;
                const fr = failRes as { error?: { code?: string; description?: string } };
                const code = String(fr?.error?.code ?? '');
                const desc = String(fr?.error?.description ?? '');

                // Do NOT abandon-checkout here: the guest may tap Pay again on the same hold
                // (TASK-2906 resume / re-order). Inventory is released on modal dismiss (handleClose)
                // or back-to-property. TTL worker remains the backstop if they leave mid-failure.
                setOrderError(`No money was taken. ${mapRazorpayFailureCode(code, desc)}`);
                // TASK-2906: Store the order ID and amount so the "Resume payment" button can retry
                setRazorpayOrderId(orderId);
                setRazorpayAmount(amount);
                setPaymentCancelled(false);
                setIsSubmitting(false);
              });
              rzp.on('close', () => {
                clearInterval(expireCheckInterval);
                handleClose();
              });

              track('payment_init', holdListingId ? Number(holdListingId) : 0);
              rzp.open();
            } catch (err) {
              console.error('[GuestDetailsPage] Razorpay init error:', err);
              setOrderError("Couldn't reach our servers. Your details are saved — check your connection and try again. No payment was taken.");
              setIsSubmitting(false);
            }
          },
          (errorMsg: string) => {
            // Script loading failed
            setOrderError(errorMsg);
            setIsSubmitting(false);
          },
        );
      } catch (err: unknown) {
        console.error('[GuestDetailsPage] order error:', err);
        const axiosErr = err as { code?: string; message?: string; response?: { status?: number; data?: { message?: string; code?: string } } };
        const status = axiosErr?.response?.status;
        const data = axiosErr?.response?.data;
        const serverMessage = typeof data?.message === 'string' ? data.message : '';

        // Detect timeout errors
        const isTimeout = axiosErr?.code === 'ECONNABORTED' || axiosErr?.message?.includes('timeout');

        if (isTimeout) {
          setOrderError('Payment initialization timed out. Please check your connection and try again.');
        } else if (status === 409) {
          // TASK-4537: Distinguish the guest's OWN confirmed booking from an availability race.
          // If the message mentions "confirmed booking" or "already exists", this is likely
          // the guest's own booking (e.g., UPI collect approved after modal dismiss, confirmed via webhook).
          const lowerMessage = serverMessage.toLowerCase();
          if (lowerMessage.includes('confirmed booking') || lowerMessage.includes('already exists')) {
            // Guest's own confirmed booking — route to confirmation page, not "pick other dates".
            const datesLabel =
              booking.checkIn && booking.checkOut
                ? `${checkInDisplay} – ${checkOutDisplay}`
                : 'those dates';
            setOrderError(
              `A confirmed booking already exists for ${datesLabel}. Check your email for the booking confirmation.`,
            );
            setOrderErrorIs409(false); // Not a race; don't show the race-specific UI
          } else {
            // Availability race — dates are no longer available.
            const datesLabel =
              booking.checkIn && booking.checkOut
                ? `${checkInDisplay} – ${checkOutDisplay}`
                : 'those dates';
            setOrderError(
              `Someone else just booked these dates. We couldn't confirm ${datesLabel}. Pick different dates to continue. No payment was taken.`,
            );
            setOrderErrorIs409(true);
          }
        } else if (status === 400 || status === 422) {
          setOrderError(`Validation error: ${serverMessage || 'Please check your details and try again.'}`);
        } else if (status && status >= 500) {
          setOrderError(`Server error: ${serverMessage || 'Please try again in a few moments.'}`);
        } else if (serverMessage) {
          setOrderError(`Couldn't start payment. ${serverMessage}`);
        } else {
          setOrderError("Couldn't reach our servers. Your details are saved — check your connection and try again. No payment was taken.");
        }
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting, holdExpired, validateForm, holdId, holdToken, phoneDialCode, formData,
      availableAddOns, selectedAddOns, referralCode, promoCode, whatsappOptIn, marketingOptIn, consentAccepted,
      holdListingId, updateBooking, navigate, booking.checkIn, booking.checkOut, displayTotal,
      checkInDisplay, checkOutDisplay, brandName,
    ],
  );

  const handleResume = useCallback(() => {
    setPaymentCancelled(false);
    setOrderError(null);
    setOrderErrorIs409(false);
    // TASK-4536: Keep the idempotency key so the retry uses the same one (deduped by Razorpay).
    // The key is preserved in currentAttemptIdempotencyKeyRef and will be reused on the next Pay tap.
  }, []);

  const handleChargedUnconfirmedRecheck = useCallback(async () => {
    const ctx = chargedUnconfirmedBookingRef.current;
    if (!ctx || chargedUnconfirmedChecking) return;
    setChargedUnconfirmedChecking(true);
    try {
      const r = await fetch(
        buildApiUrl(`/api/guest/bookings/${ctx.bookingId}/summary?t=${encodeURIComponent(ctx.pollToken ?? '')}`),
        { headers: { Accept: 'application/json', ...getApiHeaders() } },
      );
      if (r.ok) {
        const d: { status?: string } = await r.json();
        const s = d?.status;
        if (s === 'Confirmed' || s === 'CheckedIn' || s === 'PaymentReceived') {
          setChargedUnconfirmedPollExhausted(false);
          navigate(
            ctx.pollToken
              ? `/booking/${ctx.bookingId}?t=${encodeURIComponent(ctx.pollToken)}`
              : `/booking/${ctx.bookingId}`,
            { replace: true },
          );
          return;
        }
      }
      setChargedUnconfirmedPollExhausted(true);
    } catch {
      setChargedUnconfirmedPollExhausted(true);
    } finally {
      setChargedUnconfirmedChecking(false);
    }
  }, [chargedUnconfirmedChecking, navigate]);

  // Mobile: the sticky Pay bar can't show the desktop "tick consent" microcopy, so tapping
  // it while consent is unchecked scrolls the consent box into view and flashes it.
  const scrollToConsent = useCallback(() => {
    setConsentError('Please accept the consent to continue.');
    consentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setConsentFlash(true);
    window.setTimeout(() => setConsentFlash(false), 1200);
  }, []);

  // TASK-4537: Determine if the error message indicates a charged-but-unconfirmed state
  // that warrants showing clickable support affordance.
  const isChargedUnconfirmed = orderError && orderError.startsWith('Payment received but we could not confirm');

  const handleBackToProperty = useCallback(() => {
    // TASK-5183: leaving the details step must free the init-hold inventory.
    abandonPaymentPendingCheckout(holdId, holdToken ?? pendingBookingTokenRef.current);
    try { window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY); } catch { /* ignore */ }
    updateBooking({
      holdId: null, holdExpiresAt: null, holdPropertySlug: null,
      holdUnitSlug: null, holdPriceBreakdown: null, holdListingId: null, holdListingName: null,
      holdCancellationTier: null, holdCancellationWindowHours: null, holdGraceHours: null,
    });
    navigate(propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/', { replace: true });
  }, [updateBooking, navigate, propertySlug, unitSlug, holdId, holdToken]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!holdHydrationDone) {
    return (
      <div className="gd-page" aria-busy="true" aria-label="Loading your reservation">
        <style>{gdStyles}</style>
      </div>
    );
  }

  // No active hold after rehydrate attempt — show pick-dates card (PII still in sessionStorage).
  if (!holdId || !holdExpiresAt) {
    return (
      <div className="gd-page">
        <div ref={noHoldDialogRef} className="gd-modal-shade" role="dialog" aria-modal="true" aria-labelledby="gd-nohold-title">
          <div className="gd-modal">
            <div className="gd-modal-icon"><IconClock size={22} /></div>
            <h3 id="gd-nohold-title">Let's pick your dates again</h3>
            <p>
              Your {CHECKOUT_HOLD_MINUTES}-minute hold has expired or was cleared. Pick your dates again to start a
              fresh hold — any details you entered are saved and will be waiting for you.
            </p>
            <button type="button" className="gd-modal-cta" onClick={handleBackToProperty}>
              Choose dates
            </button>
          </div>
        </div>
        <style>{gdStyles}</style>
      </div>
    );
  }

  const tenantCtx = getTenantContext();
  const brandInitial = brandName.charAt(0).toUpperCase();
  const whatsappNumber = tenantCtx?.whatsappBookingPhone ?? '';
  const consentEntityName = getGuestDataProcessingEntityName();
  const paymentFailureWhatsAppUrl = `${getWhatsAppLink()}?text=${encodeURIComponent(
    'Hi, my payment just failed while booking. Can you help?',
  )}`;
  const paymentFailureTelLink = getTelLink();
  const paymentFailureEmail = getContactEmail();
  const paymentFailureMailto = `mailto:${paymentFailureEmail}?subject=${encodeURIComponent('Payment failed — need help')}`;

  const payDisabled = isSubmitting || holdExpired || !consentAccepted;

  return (
    <div className="gd-page">
      {/* ── Desktop hold strip (ink band below nav) ── */}
      <div className="gd-desktop-strip" data-testid="hold-strip">
        <div className="gd-desktop-strip-inner">
          <div className="gd-desktop-strip-left">
            <IconClock size={15}/>
            <span>
              Your dates are reserved for the next{' '}
              <b className="gd-strip-timer">{countdown}</b>.
              {'  '}Finish payment to confirm — we won't release them while you're here.
            </span>
          </div>
          <div className="gd-desktop-strip-right">
            <span>Step <b>2</b> of 2 · Details &amp; payment</span>
            <Link to={propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/'} className="gd-strip-back">
              ← Back to {propertyName || 'property'}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Mobile hold header (sticky top) ── */}
      <div className="gd-hold" data-testid="hold-header-mobile">
        <Link
          to={propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/'}
          className="gd-hold-back"
          aria-label="Back to property"
        >
          <IconChevronLeft size={18}/>
        </Link>
        <div className="gd-hold-body">
          <div className="gd-hold-title">
            Dates held for <b>{countdown}</b>
          </div>
          <div className="gd-hold-sub">Finish payment to lock them in</div>
        </div>
        <div className="gd-hold-track">
          <span style={{ width: (holdPct * 100) + '%' }} />
        </div>
      </div>

      {/* ── Hold expired modal ── */}
      {holdExpired && (
        <div ref={expiredDialogRef} className="gd-modal-shade" role="dialog" aria-modal="true" aria-labelledby="gd-expired-title">
          <div className="gd-modal">
            <div className="gd-modal-icon"><IconClock size={22}/></div>
            <h3 id="gd-expired-title">Your hold just expired.</h3>
            <p>
              The {CHECKOUT_HOLD_MINUTES}-minute reservation has ended and those dates are back on the calendar.
              Re-select to continue — your details aren't lost.
            </p>
            <button type="button" className="gd-modal-cta" onClick={handleBackToProperty}>
              Choose dates again
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout (two-col desktop, single-col mobile) ── */}
      <main className="gd-layout">
        {/* ── Left: form column ── */}
        <div className="gd-main">
          {/* Breadcrumb (desktop only) */}
          <div className="gd-breadcrumb">
            <Link to={propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/'} className="gd-breadcrumb-link">{propertyName}</Link>
            <span className="gd-breadcrumb-sep">›</span>
            <Link to={propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/'} className="gd-breadcrumb-link">{unitName}</Link>
            <span className="gd-breadcrumb-sep">›</span>
            <span className="gd-breadcrumb-current">Confirm and pay</span>
          </div>

          <h1 className="gd-page-title">Almost there — just your details.</h1>
          <p className="gd-page-sub">
            Two quick minutes. You&apos;ll get an email confirmation once payment goes through
            {whatsappOptIn ? ', and WhatsApp updates when messaging is enabled for your stay' : ''}.
          </p>

          {/* Stay recap card */}
          <div className="gd-recap" data-testid="booking-recap">
            <div className="gd-recap-thumb">
              <div className="gd-recap-thumb-id">{brandInitial}</div>
            </div>
            <div className="gd-recap-body">
              <h4 className="gd-recap-name">
                {propertyName}{unitName ? ` · ${unitName}` : ''}
              </h4>
              <div className="gd-recap-dates">{checkInDisplay} → {checkOutDisplay} · {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}</div>
              <div className="gd-recap-guests">
                <span>{booking.guests ?? 1} guest{(booking.guests ?? 1) !== 1 ? 's' : ''}</span>
                <span style={{ color: '#d6c2a8' }}>·</span>
                {propertySlug && unitSlug && (
                  <Link to={`/homes/${propertySlug}/${unitSlug}`} className="gd-recap-edit-link">
                    <IconEdit size={10}/>&nbsp;Edit
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Guest form */}
          <form onSubmit={handleSubmit} noValidate id="gd-details-form">
            {/* Who's coming */}
            <div className="gd-fset" style={{ marginTop: 0 }}>
              <div className="gd-fset-head">
                <h3>Who's coming</h3>
                <small>Needed for booking &amp; police records</small>
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-name">
                  <span>Full name <span aria-hidden="true" style={{ color: 'var(--gd-coral)', marginLeft: 4 }}>*</span></span>
                </label>
                <input
                  id="gd-name"
                  type="text"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={formErrors.name ? true : undefined}
                  aria-describedby={formErrors.name ? 'gd-name-error' : undefined}
                  className={`gd-input${formErrors.name ? ' gd-input--error' : ''}`}
                  placeholder="As on a government ID"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  data-testid="guest-booking-name"
                />
                {formErrors.name && <div id="gd-name-error" className="gd-input-help error" role="alert">{formErrors.name}</div>}
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-email">
                  <span>Email <span aria-hidden="true" style={{ color: 'var(--gd-coral)', marginLeft: 4 }}>*</span></span>
                </label>
                <input
                  id="gd-email"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={formErrors.email ? true : undefined}
                  aria-describedby={formErrors.email ? 'gd-email-help gd-email-error' : 'gd-email-help'}
                  className={`gd-input${formErrors.email ? ' gd-input--error' : ''}`}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  data-testid="guest-booking-email"
                />
                <div id="gd-email-help" className="gd-input-help">Booking confirmation goes here</div>
                {formErrors.email && <div id="gd-email-error" className="gd-input-help error" role="alert">{formErrors.email}</div>}
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-phone">
                  <span>Phone <span aria-hidden="true" style={{ color: 'var(--gd-coral)', marginLeft: 4 }}>*</span></span>
                </label>
                <div className={`gd-row${formErrors.phone ? ' gd-input--error-wrap' : ''}`}>
                  <div className="gd-dial">
                    <select
                      aria-label="Country calling code"
                      value={phoneDialCode}
                      onChange={(e) => {
                        setPhoneDialCode(e.target.value);
                        const dial = getGuestDialOption(e.target.value);
                        setFormData((p) => ({ ...p, phone: clampNationalDigits(p.phone, dial.maxDigits) }));
                      }}
                      data-testid="guest-booking-phone-dial"
                    >
                      {GUEST_DIAL_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    id="gd-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    aria-required="true"
                    aria-invalid={formErrors.phone ? true : undefined}
                    aria-describedby={formErrors.phone ? 'gd-phone-help gd-phone-error' : 'gd-phone-help'}
                    className="gd-input"
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
                <div id="gd-phone-help" className="gd-input-help">
                  {whatsappOptIn
                    ? 'Used for booking updates and check-in details when WhatsApp messaging is enabled'
                    : 'Used for booking updates and check-in details'}
                </div>
                {formErrors.phone && <div id="gd-phone-error" className="gd-input-help error" role="alert">{formErrors.phone}</div>}
              </div>

              <div className="gd-field">
                <div className="gd-field-label">
                  <span>Nationality <span style={{ color: 'var(--gd-coral)', marginLeft: 4 }}>*</span></span>
                </div>
                <div className="gd-dial">
                  <select
                    id="gd-nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData((p) => ({ ...p, nationality: e.target.value }))}
                    data-testid="guest-booking-nationality"
                  >
                    {['India','Australia','Bangladesh','Bhutan','Canada','China','France','Germany',
                      'Indonesia','Japan','Malaysia','Maldives','Nepal','Pakistan','Philippines',
                      'Russia','Singapore','South Korea','Sri Lanka','Thailand','UAE','UK','USA','Vietnam','Other'
                    ].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="gd-input-help" style={{ color: 'var(--gd-faint)', fontSize: 11.5 }}>Required for police homestay records.</div>
              </div>
            </div>

            {/* Optional disclosures */}
            <div className="gd-fset">
              <div className="gd-fset-head">
                <h3>Make it yours</h3>
                <small>All optional</small>
              </div>

              <div className="gd-disclosures">
                {/* Promo code */}
                <div className={`gd-disclosure${promoOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="gd-disclosure-trigger"
                    aria-expanded={promoOpen}
                    aria-controls="gd-promo-panel"
                    onClick={() => setPromoOpen((v) => !v)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--gd-coral)' }}><IconTag size={14}/></span>
                      Promo code
                      {promoValidating && (
                        <span className="gd-pill">Checking code…</span>
                      )}
                      {!promoValidating && serverPromoLocked && promoDiscountAmount > 0 && (
                        <span className="gd-pill">−{displayPrice(promoDiscountAmount)}</span>
                      )}
                      {!promoValidating && !serverPromoLocked && appliedPromoCode && promoDiscountAmount > 0 && (
                        <span className="gd-pill">Pending confirmation</span>
                      )}
                    </span>
                    <span className="gd-disc-side">
                      {!appliedPromoCode && <span>Got a code?</span>}
                      <IconChevronDown size={16}/>
                    </span>
                  </button>
                  <div id="gd-promo-panel" className="gd-disclosure-panel gd-disclosure-panel-pad-top" data-testid="gd-promo-panel">
                    <div className="gd-inline-input">
                      <input
                        id="gd-promo-input"
                        type="text"
                        aria-label="Promo code"
                        aria-describedby={!promoValidating && promoMessage ? 'gd-promo-message' : undefined}
                        aria-invalid={!promoValidating && promoMessage && !appliedPromoCode ? true : undefined}
                        placeholder="Enter code"
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
                      <button type="button" onClick={() => void handlePromoBlur()} disabled={promoValidating}>
                        {appliedPromoCode ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                    {promoValidating && <div className="gd-input-help">Checking code…</div>}
                    {!promoValidating && promoMessage && (
                      <div id="gd-promo-message" className={`gd-input-help${appliedPromoCode ? ' success' : ' error'}`} role={appliedPromoCode ? undefined : 'alert'}>
                        {promoMessage}
                      </div>
                    )}
                    {!promoValidating && !promoMessage && promoCode && (
                      <div className="gd-input-help">Codes are case-insensitive. Tax recalculates after apply.</div>
                    )}
                  </div>
                </div>

                {/* Referral code */}
                <div className={`gd-disclosure${referralOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="gd-disclosure-trigger"
                    aria-expanded={referralOpen}
                    aria-controls="gd-referral-panel"
                    onClick={() => setReferralOpen((v) => !v)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--gd-coral)' }}><IconGift size={14}/></span>
                      Referral code
                      {appliedReferralCode && referralDiscountAmount > 0 && (
                        <span className="gd-pill">−{displayPrice(referralDiscountAmount)} applied</span>
                      )}
                    </span>
                    <span className="gd-disc-side">
                      {!appliedReferralCode && <span>Friend sent you one?</span>}
                      <IconChevronDown size={16}/>
                    </span>
                  </button>
                  <div id="gd-referral-panel" className="gd-disclosure-panel gd-disclosure-panel-pad-top" data-testid="gd-referral-panel">
                    <div className="gd-inline-input">
                      <input
                        id="gd-referral-input"
                        type="text"
                        aria-label="Referral code"
                        aria-describedby={!referralValidating && referralMessage ? 'gd-referral-message' : undefined}
                        aria-invalid={!referralValidating && referralMessage && referralMessage.includes('must be') ? true : undefined}
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
                      <button type="button" onClick={handleReferralBlur} disabled={referralValidating}>
                        {referralDiscountAmount > 0 ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                    {referralValidating && <div className="gd-input-help">Validating…</div>}
                    {!referralValidating && referralMessage && (
                      <div
                        id="gd-referral-message"
                        className={`gd-input-help${referralMessage.includes('must be') ? ' error' : ''}`}
                        role={referralMessage.includes('must be') ? 'alert' : undefined}
                      >
                        {referralMessage}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add-ons (only if available) */}
                {availableAddOns.length > 0 && (
                  <div className={`gd-disclosure${addOnsOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="gd-disclosure-trigger"
                      aria-expanded={addOnsOpen}
                      aria-controls="gd-addons-panel"
                      onClick={() => setAddOnsOpen((v) => !v)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: 'var(--gd-coral)' }}><IconSparkles size={14}/></span>
                        Add-on services
                        {addOnsTotal > 0 && (
                          <span className="gd-pill">+{displayPrice(addOnsTotal)}</span>
                        )}
                      </span>
                      <span className="gd-disc-side">
                        <span>{availableAddOns.length} available</span>
                        <IconChevronDown size={16}/>
                      </span>
                    </button>
                    <div id="gd-addons-panel" className="gd-disclosure-panel gd-disclosure-panel-pad-top">
                      {availableAddOns.map((ao) => {
                        const qty = selectedAddOns[ao.addOnServiceId] ?? 0;
                        const lineTotal = addOnLineTotal(ao, qty || 1, nights, stayGuestCount);
                        return (
                          <div key={ao.addOnServiceId} className="gd-addon">
                            <div>
                              <div className="gd-addon-name">{ao.name}</div>
                              {ao.description && <div className="gd-addon-desc">{ao.description}</div>}
                              <div className="gd-addon-desc">
                                {displayPrice(ao.price)} {addOnPriceHint(ao.priceType, nights, stayGuestCount)}
                              </div>
                            </div>
                            <div className="gd-addon-price" style={{ textAlign: 'right' }}>
                              {qty > 0 ? displayPrice(lineTotal) : displayPrice(ao.price)}
                              <div className="gd-addon-qty">
                                <button
                                  type="button"
                                  className="gd-addon-qty-btn"
                                  aria-label={`Decrease ${ao.name}`}
                                  disabled={qty <= 0}
                                  onClick={() => setSelectedAddOns((p) => ({
                                    ...p,
                                    [ao.addOnServiceId]: Math.max(0, (p[ao.addOnServiceId] ?? 0) - 1),
                                  }))}
                                >
                                  −
                                </button>
                                <span className="gd-addon-qty-val" aria-live="polite">{qty}</span>
                                <button
                                  type="button"
                                  className="gd-addon-qty-btn"
                                  aria-label={`Increase ${ao.name}`}
                                  disabled={qty >= ADD_ON_MAX_QTY}
                                  onClick={() => setSelectedAddOns((p) => ({
                                    ...p,
                                    [ao.addOnServiceId]: Math.min(ADD_ON_MAX_QTY, (p[ao.addOnServiceId] ?? 0) + 1),
                                  }))}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className={`gd-disclosure${notesOpen ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="gd-disclosure-trigger"
                    aria-expanded={notesOpen}
                    aria-controls="gd-notes-panel"
                    onClick={() => setNotesOpen((v) => !v)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--gd-coral)' }}><IconNote size={14}/></span>
                      Notes or special requests
                    </span>
                    <span className="gd-disc-side">
                      <span>Anything we should know?</span>
                      <IconChevronDown size={16}/>
                    </span>
                  </button>
                  <div id="gd-notes-panel" className="gd-disclosure-panel gd-disclosure-panel-pad-top" data-testid="gd-notes-panel">
                    <textarea
                      className="gd-input"
                      rows={3}
                      maxLength={500}
                      placeholder="E.g. early check-in, dietary needs, accessibility requests"
                      value={formData.notes}
                      onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                      style={{ resize: 'vertical' }}
                      data-testid="guest-booking-notes"
                    />
                    <div className="gd-input-help">Max 500 characters · we share these with your host directly.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consent block */}
            <div className="gd-consent">
              {/* DPDP required consent */}
              <div
                ref={consentRowRef}
                className={`gd-consent-row required${consentAccepted ? ' checked' : ''}${consentFlash ? ' gd-consent-flash' : ''}`}
                onClick={() => { setConsentAccepted((v) => !v); if (!consentAccepted) setConsentError(''); }}
                role="checkbox"
                aria-checked={consentAccepted}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && setConsentAccepted((v) => { if (!v) setConsentError(''); return !v; })}
                data-testid="guest-booking-consent-row"
              >
                <span className={`gd-check${consentAccepted ? ' checked' : ''}`}>
                  <IconCheck size={14}/>
                </span>
                <div className="gd-consent-body">
                  I consent to <b>{consentEntityName}</b> collecting and using my name, phone, and email to process this booking and send booking-related communications.{' '}
                  <Link to="/privacy" className="gd-consent-link" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>
                  {' '}&amp;{' '}
                  <Link to="/terms" className="gd-consent-link" onClick={(e) => e.stopPropagation()}>Guest Terms</Link>.
                  <span className="gd-consent-tag">Required · booking &amp; contact · DPDP Act, 2023</span>
                  {/* Hidden native checkbox for testid compatibility */}
                  <input
                    type="checkbox"
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                    checked={consentAccepted}
                    onChange={(e) => { setConsentAccepted(e.target.checked); if (e.target.checked) setConsentError(''); }}
                    aria-invalid={Boolean(consentError)}
                    data-testid="guest-booking-consent"
                    tabIndex={-1}
                  />
                </div>
              </div>
              {consentError && <div className="gd-input-help error" role="alert">{consentError}</div>}

              {/* WhatsApp opt-in — pre-checked */}
              <div
                className={`gd-consent-row${whatsappOptIn ? ' checked' : ''}`}
                onClick={() => setWhatsappOptIn((v) => !v)}
                role="checkbox"
                aria-checked={whatsappOptIn}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && setWhatsappOptIn((v) => !v)}
              >
                <span className={`gd-check${whatsappOptIn ? ' checked' : ''}`}>
                  <IconCheck size={14}/>
                </span>
                <div className="gd-consent-body">
                  Send my booking updates on <b>WhatsApp</b> — confirmations, directions, host messages.{' '}
                  <span style={{ color: 'var(--gd-faint)' }}>(Optional — transactional WhatsApp.)</span>
                </div>
              </div>

              {/* Marketing opt-in — optional, separate purpose (TASK-5137) */}
              <div
                className={`gd-consent-row${marketingOptIn ? ' checked' : ''}`}
                onClick={() => setMarketingOptIn((v) => !v)}
                role="checkbox"
                aria-checked={marketingOptIn}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && setMarketingOptIn((v) => !v)}
                data-testid="guest-booking-marketing-consent-row"
              >
                <span className={`gd-check${marketingOptIn ? ' checked' : ''}`}>
                  <IconCheck size={14}/>
                </span>
                <div className="gd-consent-body">
                  Send me promotional offers and deals from <b>{consentEntityName}</b>.{' '}
                  <span style={{ color: 'var(--gd-faint)' }}>(Optional — you can withdraw anytime from your preferences link.)</span>
                </div>
              </div>
            </div>

            {/* Error banners */}
            {serverTotalConfirmRequired && razorpayAmountPaise != null && (
              <div
                ref={serverTotalWarnRef}
                className="gd-alert gd-alert-warn"
                role="status"
                data-testid="guest-checkout-total-updated"
              >
                <b>Total updated.</b> Final price from our server is{' '}
                <b>{displayPrice(razorpayAmountPaise / 100)}</b> (your estimate was{' '}
                {displayPrice(displayTotal)}). Tap <b>Pay</b> again to confirm and open payment.
              </div>
            )}
            {orderError && !orderErrorIs409 && (
              <div className="gd-banner" role="alert" data-testid="guest-checkout-order-error">
                <IconAlert size={16}/>
                <div>
                  <b>
                    {orderError.startsWith('Couldn')
                      ? 'Payment cancelled — no money taken.'
                      : orderError.startsWith('No money was taken')
                        ? 'Payment failed — no money taken.'
                        : isChargedUnconfirmed
                          ? 'Payment received — we\'re confirming your booking.'
                          : 'Something went wrong.'}
                  </b><br/>
                  <span>{orderError}</span>
                  {/* TASK-4537: Show support affordance for both "No money taken" (need to retry)
                      and charged-unconfirmed (already charged, monitoring for confirmation). */}
                  {(orderError.startsWith('No money was taken') || isChargedUnconfirmed) && (
                    <div style={{ marginTop: 12 }} data-testid="payment-failed-support">
                      <p style={{ margin: '0 0 8px', fontSize: 14 }}>
                        {isChargedUnconfirmed
                          ? chargedUnconfirmedPollExhausted
                            ? 'Automatic checks have paused — tap Check again or reach out if you need help.'
                            : 'We\'re still checking automatically — no need to pay again.'
                          : 'Need help finishing your booking?'}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center' }}>
                        {isChargedUnconfirmed && (
                          <button
                            type="button"
                            className="gd-resume-btn"
                            onClick={() => { void handleChargedUnconfirmedRecheck(); }}
                            disabled={chargedUnconfirmedChecking}
                            data-testid="charged-unconfirmed-recheck"
                          >
                            {chargedUnconfirmedChecking ? 'Checking…' : 'Check again'}
                          </button>
                        )}
                        {!isChargedUnconfirmed && razorpayOrderId && (
                          <button type="button" className="gd-resume-btn" onClick={handleResume}>
                            Resume payment
                          </button>
                        )}
                        <a href={paymentFailureWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                          <IconWhatsApp size={14} /> WhatsApp us
                        </a>
                        <a href={paymentFailureTelLink}>Call {formatDisplayNumber()}</a>
                        <a href={paymentFailureMailto}>Email {paymentFailureEmail}</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 409 race — full-page-style inline */}
            {orderError && orderErrorIs409 && (
              <div className="gd-banner" role="alert">
                <IconAlert size={16}/>
                <div>
                  <b>Someone else just booked these dates.</b><br/>
                  <span>{orderError}</span>
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="gd-modal-cta" style={{ marginTop: 0 }} onClick={handleBackToProperty}>
                      Back to {propertyName || 'property'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment cancelled inline banner */}
            {paymentCancelled && !orderError && (
              <div className="gd-banner" style={{ background: 'var(--gd-peach)', borderColor: 'var(--gd-line-strong)', color: 'var(--gd-ink-soft)' }} role="status">
                <IconAlert size={16}/>
                <div>
                  <b style={{ color: 'var(--gd-ink)' }}>Payment cancelled — no money taken.</b><br/>
                  Your dates are still held for{' '}
                  <b style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--gd-coral)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{countdown}</b>.
                  {' '}Ready to try again?
                  {razorpayOrderId && (
                    <span>
                      {' '}<button type="button" className="gd-resume-btn" onClick={handleResume}>
                        Resume payment
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </form>

          {/* Pay rail (mobile only — desktop in aside) */}
          <div className="gd-pay-rail gd-pay-rail--mobile">
            <span className="gd-pay-rail-label">Pay with</span>
            <span className="gd-pay-mark">UPI</span>
            <span className="gd-pay-mark">VISA</span>
            <span className="gd-pay-mark">RuPay</span>
            <span className="gd-pay-mark">Net banking</span>
            <span className="gd-pay-mark razorpay">Razorpay</span>
          </div>

          {/* Trust band (mobile only — desktop in aside) */}
          <TrustBand
            freeCancellationCopy={freeCancellationCopy}
            brandName={brandName}
            whatsappNumber={whatsappNumber}
            className="gd-trust--mobile"
          />
        </div>

        {/* ── Right: sticky aside ── */}
        <aside className="gd-aside">
          {/* Hold chip in aside */}
          <div className="gd-hold-chip">
            <div className="gd-hold-chip-clock">{countdown}</div>
            <div className="gd-hold-chip-text">
              <b>Dates held</b><br/>
              Finish to confirm
            </div>
          </div>

          {/* Aside recap */}
          <div className="gd-aside-recap">
            <div className="gd-aside-thumb">
              <div className="gd-aside-thumb-id">{brandInitial}</div>
            </div>
            <div>
              <h4 className="gd-aside-stay-name">{propertyName}{unitName ? ` · ${unitName}` : ''}</h4>
              <div className="gd-aside-stay-dates">
                {checkInDisplay} → {checkOutDisplay} · {nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : ''} · {booking.guests ?? 1} guest{(booking.guests ?? 1) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Price block */}
          <div className="gd-price-rows">
            <div className="gd-price-row" data-testid="price-line-base">
              <div className="desc">
                <span>
                  {nights > 0 && perNight > 0
                    ? `${displayPrice(perNight)} × ${nights} ${nights === 1 ? 'night' : 'nights'}`
                    : 'Accommodation'}
                </span>
              </div>
              <span className="num">{displayPrice(baseAmount)}</span>
            </div>
            {cleaningFeeAmount > 0 && (
              <div className="gd-price-row">
                <span>Cleaning fee</span>
                <span className="num">{displayPrice(cleaningFeeAmount)}</span>
              </div>
            )}
            {addOnsTotal > 0 && (
              <div className="gd-price-row">
                <span>Add-on services</span>
                <span className="num">{displayPrice(addOnsTotal)}</span>
              </div>
            )}
            {confirmedPromoDiscount > 0 && (
              <div className="gd-price-row save" data-testid="promo-confirmed-row">
                <span>Promo{appliedPromoCode ? ` · ${appliedPromoCode}` : ''}</span>
                <span className="num">−{displayPrice(confirmedPromoDiscount)}</span>
              </div>
            )}
            {referralDiscountAmount > 0 && (
              <div className="gd-price-row save">
                <span>Referral{appliedReferralCode ? ` · ${appliedReferralCode}` : ''}</span>
                <span className="num">−{displayPrice(referralDiscountAmount)}</span>
              </div>
            )}
            {gstSlabPercent != null && gstLineAmount > 0 && (
              <div className="gd-price-row gst">
                <div className="desc">
                  <span>GST {gstSlabPercent}%</span>
                </div>
                <span className="num">{displayPrice(gstLineAmount)}</span>
              </div>
            )}
            {touristTaxAmount > 0 && (
              <div className="gd-price-row" data-testid="tourist-tax-row">
                <span>Tourist tax</span>
                <span className="num">{displayPrice(touristTaxAmount)}</span>
              </div>
            )}
            {convenienceFeeAmount > 0 && (
              <div className="gd-price-row" title="Razorpay payment gateway fee — passed through, not a platform markup.">
                <span>Payment processing</span>
                <span className="num">{displayPrice(convenienceFeeAmount)}</span>
              </div>
            )}
          </div>

          <div className="gd-price-total">
            <span className="label">Total</span>
            <div style={{ textAlign: 'right' }}>
              <div className="num">{displayPrice(displayTotal)}</div>
              <small className="num-sub">Includes GST · INR</small>
            </div>
          </div>

          {/* TASK-4161: Consumer Protection (E-Commerce) Rules 2020 — Razorpay on-behalf-of
              disclosure for white-label / custom-domain tenants only. */}
          {tenantCtx?.legalContactPack?.isCustomDomain && (
            <p
              data-testid="razorpay-mor-disclosure"
              style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginBottom: 8, lineHeight: 1.5 }}
            >
              Payments are processed by Razorpay on behalf of{' '}
              <strong>{tenantCtx.legalContactPack.legalName ?? brandName}</strong>.
            </p>
          )}

          {/* Pay CTA */}
          <button
            type="submit"
            form="gd-details-form"
            className="gd-pay"
            disabled={payDisabled}
            data-testid="guest-booking-submit"
          >
            {isSubmitting
              ? <><IconSpinner size={16}/> Securing your booking…</>
              : <><IconLock size={14}/> Pay <span className="num">{displayPrice(chargeInr)}</span> to confirm</>
            }
          </button>

          {/* Pay microcopy */}
          {!consentAccepted && (
            <div className="gd-pay-microcopy">Tick the consent box to enable payment.</div>
          )}
          {consentAccepted && (
            <div className="gd-pay-microcopy">
              You'll be charged <b>{displayPrice(chargeInr)}</b> now to confirm.
              {freeCancellationCopy?.deadlineFormatted
                && ` Free cancellation until ${freeCancellationCopy.deadlineFormatted}.`}
              {freeCancellationCopy?.trustMessage
                && !freeCancellationCopy.deadlineFormatted
                && ` ${freeCancellationCopy.trustMessage}`}
              {/* TASK-7012: lapsed tier deadline but a live grace window — state the window that is
                  actually honoured instead of leaving the charge line with no cancellation terms. */}
              {!freeCancellationCopy?.deadlineFormatted
                && !freeCancellationCopy?.trustMessage
                && freeCancellationCopy?.applicableGraceHours
                && ` Free cancellation for ${freeCancellationCopy.applicableGraceHours} hours after you book.`}
              {/* TASK-4410: INR charge disclosure for non-INR shoppers */}
              {currency !== 'INR' && (
                <div style={{ marginTop: 8, fontSize: '0.85em', color: '#64748b' }}>
                  Charged in {formatINR(chargeInr)} — your bank may apply its own conversion fee.
                </div>
              )}
            </div>
          )}

          {/* Pay rail (desktop) */}
          <div className="gd-pay-rail">
            <span className="gd-pay-rail-label">Pay with</span>
            <span className="gd-pay-mark">UPI</span>
            <span className="gd-pay-mark">VISA</span>
            <span className="gd-pay-mark">RuPay</span>
            <span className="gd-pay-mark">Net banking</span>
            <span className="gd-pay-mark razorpay">Razorpay</span>
          </div>

          {/* Trust band (desktop) */}
          <TrustBand
            freeCancellationCopy={freeCancellationCopy}
            brandName={brandName}
            whatsappNumber={whatsappNumber}
          />
        </aside>
      </main>

      {/* ── Mobile sticky bottom bar ── */}
      <div className="gd-mobile-bar">
        <div className="gd-mobile-bar-clock">
          <b>{countdown}</b>
          <small>Held</small>
        </div>
        <button
          type={consentAccepted ? 'submit' : 'button'}
          form="gd-details-form"
          className="gd-mobile-bar-cta"
          disabled={isSubmitting || holdExpired}
          onClick={consentAccepted ? undefined : scrollToConsent}
          data-testid="guest-booking-submit-mobile"
        >
          {isSubmitting
            ? <><IconSpinner size={14}/> Securing…</>
            : serverTotalConfirmRequired
              ? <><IconLock size={14}/> Confirm <span className="num">{displayPrice(chargeInr)}</span></>
              : <><IconLock size={14}/> Pay <span className="num">{displayPrice(chargeInr)}</span></>
          }
        </button>
      </div>

      <style>{gdStyles}</style>
    </div>
  );
};

// ── TrustBand atom ────────────────────────────────────────────────────────────
interface TrustBandProps {
  freeCancellationCopy: FreeCancellationTrustCopy | null;
  brandName: string;
  whatsappNumber: string;
  className?: string;
}
const TrustBand: React.FC<TrustBandProps> = ({ freeCancellationCopy, brandName, whatsappNumber, className }) => (
  <div className={`gd-trust${className ? ` ${className}` : ''}`}>
    <div className="gd-trust-row">
      <IconCheck size={14}/>
      <span>
        {freeCancellationCopy?.deadlineFormatted ? (
          <>
            <b>Free cancellation</b>
            {` until ${freeCancellationCopy.deadlineFormatted}.`}
          </>
        ) : freeCancellationCopy?.trustMessage ? (
          freeCancellationCopy.trustMessage
        ) : freeCancellationCopy?.applicableGraceHours ? (
          // TASK-7012: tier deadline has lapsed but the universal grace window still applies —
          // disclose the window that IS honoured rather than an unqualified "policy applies".
          <>
            <b>Free cancellation</b>
            {` for ${freeCancellationCopy.applicableGraceHours} hours after you book.`}
          </>
        ) : (
          // TASK-7012: only reachable before a check-in date is known (no booking context to resolve
          // a policy against). Once dates ARE known, `resolveFreeCancellationTrustCopy` always returns
          // either a live deadline or the standard-policy sentence — never this unqualified claim,
          // which would over-promise a refund the server will not issue on a lapsed policy.
          <>
            <b>Free cancellation</b>
            {' policy applies.'}
          </>
        )}
      </span>
    </div>
    <div className="gd-trust-row">
      <IconLock size={14}/>
      <span>Direct booking · secure payment via Razorpay · <b>no OTA fee</b> · 3% payment processing at checkout</span>
    </div>
    {whatsappNumber && (
      <div className="gd-trust-row">
        <span style={{ color: '#25D366' }}><IconWhatsApp size={14}/></span>
        <span>
          Stuck?{' '}
          <a
            // TASK-4294/TASK-4300: use the canonical contact helpers — getWhatsAppLink() carries
            // the 91 country code and formatDisplayNumber() shows "+91-…", instead of the raw
            // tenant whatsappBookingPhone (no +, no country code, wrong number on the marketplace).
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp {brandName} on {formatDisplayNumber()}
          </a>
        </span>
      </div>
    )}
  </div>
);

// ── Inline styles — verbatim .gd-* tokens from bundle styles.css ─────────────
const gdStyles = `
@keyframes gd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

:root {
  --gd-ink: #4a3535;
  --gd-ink-soft: #3b3b52;
  --gd-muted: #475569;
  --gd-faint: #64748b;
  --gd-ivory: #fff8e7;
  --gd-linen: #fdf2e9;
  --gd-peach: #ffe4d6;
  --gd-line: #f0ddd0;
  --gd-line-strong: #e5cfc0;
  --gd-coral: #b8472f;
  --gd-coral-dark: #a84832;
  --gd-amber: #f08c71;
  --gd-success: #157046;
  --gd-success-bg: #e9f5ef;
  --gd-success-border: #d2ebde;
  --gd-danger: #b91c1c;
  --gd-danger-bg: #fbeceb;
  --gd-danger-border: #f3cfcc;
}

.gd-page {
  min-height: 100vh;
  background: var(--gd-ivory);
  font-family: "DM Sans", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Desktop hold strip (ink band, never red) */
.gd-desktop-strip {
  background: var(--gd-ink);
  color: var(--gd-ivory);
  padding: 10px 28px;
  font-size: 13px;
  display: none;
}
@media (min-width: 1024px) { .gd-desktop-strip { display: block; } }
.gd-desktop-strip-inner {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.gd-desktop-strip-left {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 248, 231,0.85);
}
.gd-strip-timer {
  color: var(--gd-amber);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.gd-desktop-strip-right {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: rgba(255, 248, 231,0.6);
}
.gd-desktop-strip-right b { color: #fff8e7; }
.gd-strip-back {
  color: rgba(255, 248, 231,0.85);
  text-decoration: none;
}

/* Mobile hold header */
.gd-hold {
  background: #fff;
  border-bottom: 1px solid var(--gd-line);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  position: relative;
}
@media (min-width: 1024px) { .gd-hold { display: none; } }
.gd-hold-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 999px;
  background: var(--gd-ivory);
  border: 1px solid var(--gd-line);
  color: var(--gd-ink);
  flex-shrink: 0;
  text-decoration: none;
}
.gd-hold-body { flex: 1; min-width: 0; }
.gd-hold-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gd-ink);
  line-height: 1.25;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.gd-hold-title b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--gd-coral);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.gd-hold-sub {
  font-size: 11.5px;
  color: var(--gd-faint);
  margin-top: 1px;
  line-height: 1.3;
}
.gd-hold-track {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: var(--gd-peach);
}
.gd-hold-track > span {
  display: block;
  height: 100%;
  background: var(--gd-coral);
  border-radius: 0 999px 999px 0;
}

/* Hold chip (aside) */
.gd-hold-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--gd-linen);
  border: 1px solid var(--gd-line);
  border-radius: 12px;
  margin-bottom: 18px;
}
.gd-hold-chip-clock {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--gd-coral);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.gd-hold-chip-text {
  font-size: 12.5px;
  color: var(--gd-ink-soft);
  line-height: 1.4;
}
.gd-hold-chip-text b { color: var(--gd-ink); font-weight: 600; }

/* Expired modal */
.gd-modal-shade {
  position: fixed;
  inset: 0;
  background: rgba(26,26,46,0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}
.gd-modal {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 24px 72px rgba(26,26,46,0.18);
  text-align: left;
}
.gd-modal-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: var(--gd-peach);
  color: var(--gd-coral);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.gd-modal h3 {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 24px;
  line-height: 1.15;
  margin: 0 0 8px;
  letter-spacing: -0.005em;
}
.gd-modal p {
  font-size: 14px;
  color: var(--gd-muted);
  line-height: 1.55;
  margin: 0 0 18px;
}
.gd-modal-cta {
  display: block;
  width: 100%;
  background: var(--gd-coral);
  color: #fff;
  border: 0;
  border-radius: 12px;
  padding: 14px 18px;
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}

/* Main layout */
.gd-layout {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 100px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  align-items: start;
}
@media (min-width: 1024px) {
  .gd-layout {
    grid-template-columns: minmax(0, 560px) 380px;
    gap: 56px;
    padding: 32px 28px 64px;
  }
}

/* Breadcrumb (desktop only) */
.gd-breadcrumb {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--gd-faint);
  margin-bottom: 14px;
}
@media (min-width: 1024px) { .gd-breadcrumb { display: flex; } }
.gd-breadcrumb-link { color: var(--gd-faint); text-decoration: none; }
.gd-breadcrumb-sep { color: #d6c2a8; }
.gd-breadcrumb-current { color: var(--gd-ink); font-weight: 600; }

/* Page title */
.gd-page-title {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: -0.005em;
  color: var(--gd-ink);
  margin: 0 0 4px;
}
@media (min-width: 1024px) { .gd-page-title { font-size: 36px; } }
.gd-page-sub {
  font-size: 13.5px;
  color: var(--gd-muted);
  margin: 0 0 22px;
  line-height: 1.55;
}

/* Recap card */
.gd-recap {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--gd-line);
  border-radius: 14px;
  padding: 14px;
  align-items: center;
  margin-bottom: 22px;
}
.gd-recap-thumb {
  width: 72px; height: 72px;
  border-radius: 10px;
  background: radial-gradient(120% 100% at 25% 0%, #fdf2e9 0%, #ffe4d6 55%, #f6dcc2 100%);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.gd-recap-thumb-id {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-size: 48px;
  color: rgba(196, 90, 63,0.32);
  line-height: 1;
}
.gd-recap-body { min-width: 0; }
.gd-recap-name {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 19px;
  line-height: 1.15;
  margin: 0 0 4px;
  color: var(--gd-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gd-recap-dates {
  font-size: 13px;
  color: var(--gd-ink);
  font-weight: 600;
  line-height: 1.35;
}
.gd-recap-guests {
  font-size: 12px;
  color: var(--gd-muted);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.gd-recap-edit-link {
  color: var(--gd-coral);
  font-weight: 600;
  text-decoration: none;
  font-size: 12px;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* Form sections */
.gd-fset { margin-top: 28px; }
.gd-fset:first-child { margin-top: 0; }
.gd-fset-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.gd-fset-head h3 {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 22px;
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.005em;
}
.gd-fset-head small { font-size: 12px; color: var(--gd-faint); }

.gd-field { margin-bottom: 12px; }
.gd-field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--gd-muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}
.gd-input {
  width: 100%;
  background: #fff;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 12px;
  padding: 13px 14px;
  font-family: inherit;
  font-size: 15px;
  color: var(--gd-ink);
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease;
  -webkit-appearance: none;
  box-sizing: border-box;
}
.gd-input::placeholder { color: #aaa097; }
.gd-input:focus {
  border-color: var(--gd-coral);
  box-shadow: 0 0 0 4px rgba(196, 90, 63,0.12);
}
.gd-input--error { border-color: var(--gd-coral) !important; }
.gd-input-help {
  font-size: 11.5px;
  color: var(--gd-faint);
  margin-top: 4px;
  line-height: 1.4;
}
.gd-input-help.error { color: var(--gd-danger); }
.gd-input-help.success { color: var(--gd-success); font-weight: 600; }

/* Phone row */
.gd-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px; }
.gd-input--error-wrap .gd-dial select,
.gd-input--error-wrap .gd-input { border-color: var(--gd-coral); }

.gd-dial { position: relative; }
.gd-dial select {
  width: 100%;
  background: #fff;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 12px;
  padding: 13px 28px 13px 14px;
  font-family: inherit;
  font-size: 15px;
  color: var(--gd-ink);
  font-weight: 600;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}
.gd-dial select:focus {
  border-color: var(--gd-coral);
  box-shadow: 0 0 0 4px rgba(196, 90, 63,0.12);
}
.gd-dial::after {
  content: "";
  position: absolute;
  right: 12px; top: 50%;
  width: 8px; height: 8px;
  border-right: 1.5px solid var(--gd-ink);
  border-bottom: 1.5px solid var(--gd-ink);
  transform: translateY(-75%) rotate(45deg);
  pointer-events: none;
}

/* Progressive disclosure */
.gd-disclosures { display: grid; gap: 8px; }
.gd-disclosure {
  background: #fff;
  border: 1px solid var(--gd-line);
  border-radius: 12px;
  overflow: hidden;
}
.gd-disclosure-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: 0;
  padding: 13px 16px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--gd-ink);
  cursor: pointer;
  text-align: left;
  gap: 12px;
}
.gd-disc-side {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--gd-faint);
  flex-shrink: 0;
}
.gd-disclosure-trigger svg { color: var(--gd-faint); transition: transform .2s ease; }
.gd-disclosure.open .gd-disclosure-trigger svg { transform: rotate(180deg); }
.gd-disclosure-panel {
  display: none;
  padding: 0 16px 16px;
  border-top: 1px solid var(--gd-line);
}
.gd-disclosure.open .gd-disclosure-panel { display: block; }
.gd-disclosure-panel-pad-top { padding-top: 14px; }

/* Pill badge */
.gd-pill {
  background: var(--gd-peach);
  color: var(--gd-coral);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

/* Inline input (promo/referral) */
.gd-inline-input {
  display: flex;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.gd-inline-input input {
  flex: 1;
  border: 0;
  padding: 12px 14px;
  font-family: inherit;
  font-size: 14.5px;
  color: var(--gd-ink);
  outline: none;
  background: transparent;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.gd-inline-input input::placeholder { text-transform: none; letter-spacing: 0; color: #aaa097; }
.gd-inline-input button {
  background: var(--gd-ink);
  color: var(--gd-ivory);
  border: 0;
  padding: 0 18px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.gd-inline-input button[disabled] { background: var(--gd-line-strong); color: var(--gd-faint); cursor: not-allowed; }

/* Add-on checklist */
.gd-addon {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--gd-line);
  align-items: center;
}
.gd-addon:first-child { border-top: 0; }
.gd-addon-name { font-size: 14px; font-weight: 600; color: var(--gd-ink); line-height: 1.3; }
.gd-addon-desc { font-size: 12px; color: var(--gd-faint); line-height: 1.4; margin-top: 2px; }
.gd-addon-price { font-size: 14px; color: var(--gd-ink); font-weight: 600; font-variant-numeric: tabular-nums; }
/* TASK-1775: add-on +/- tap targets ≥48px (moved from UnitBookingWidget) */
.gd-addon-qty {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}
.gd-addon-qty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border: 1px solid var(--gd-line, #e8e0d8);
  border-radius: 10px;
  background: #fff;
  color: var(--gd-ink);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}
.gd-addon-qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.gd-addon-qty-val {
  min-width: 1.5rem;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Custom checkbox */
.gd-check {
  width: 22px; height: 22px;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 6px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all .15s ease;
}
.gd-check.checked {
  background: var(--gd-coral);
  border-color: var(--gd-coral);
  color: #fff;
}
.gd-check svg { opacity: 0; }
.gd-check.checked svg { opacity: 1; }

/* Consent block */
.gd-consent { margin-top: 22px; display: grid; gap: 12px; }
.gd-consent-row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 12px;
  padding: 14px 16px;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color .18s ease;
  position: relative;
}
.gd-consent-row.required { border-color: var(--gd-coral); background: #fff8f2; }
.gd-consent-row.checked { border-color: var(--gd-success); background: var(--gd-success-bg); }
.gd-consent-flash { animation: gd-consent-flash 1.2s ease-out; }
@keyframes gd-consent-flash {
  0%   { box-shadow: 0 0 0 0 rgba(196, 90, 63, 0); }
  25%  { box-shadow: 0 0 0 4px rgba(196, 90, 63, 0.35); }
  100% { box-shadow: 0 0 0 0 rgba(196, 90, 63, 0); }
}
.gd-consent-body { font-size: 13px; color: var(--gd-ink-soft); line-height: 1.5; }
.gd-consent-body b { color: var(--gd-ink); font-weight: 600; }
.gd-consent-link { color: var(--gd-coral); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
.gd-consent-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--gd-coral);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-left: 6px;
}

/* Aside (desktop sticky) */
.gd-aside {
  display: none;
  background: #fff;
  border: 1px solid var(--gd-line);
  border-radius: 18px;
  padding: 22px;
  box-shadow: 0 12px 28px rgba(26,26,46,0.07), 0 4px 12px rgba(26,26,46,0.04);
  position: sticky;
  top: 24px;
}
@media (min-width: 1024px) { .gd-aside { display: block; } }

.gd-aside-recap {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--gd-line);
  align-items: center;
}
.gd-aside-thumb {
  width: 56px; height: 56px;
  border-radius: 10px;
  background: radial-gradient(120% 100% at 25% 0%, #fdf2e9 0%, #ffe4d6 55%, #f6dcc2 100%);
  position: relative;
  overflow: hidden;
}
.gd-aside-thumb-id {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-size: 36px;
  color: rgba(196, 90, 63,0.32);
  line-height: 1;
}
.gd-aside-stay-name {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 17px;
  line-height: 1.15;
  margin: 0;
}
.gd-aside-stay-dates { font-size: 12.5px; color: var(--gd-muted); margin-top: 2px; }

/* Price rows */
.gd-price-rows { display: grid; gap: 10px; font-size: 13.5px; color: var(--gd-muted); }
.gd-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
}
.gd-price-row .num { font-variant-numeric: tabular-nums; }
.gd-price-row .desc { display: flex; flex-direction: column; }
.gd-price-row .desc small { font-size: 11.5px; color: var(--gd-faint); line-height: 1.3; }
.gd-price-row.save { color: var(--gd-success); font-weight: 600; }
.gd-price-row.gst { color: var(--gd-muted); }

.gd-price-total {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1.5px solid var(--gd-line);
}
.gd-price-total .label {
  font-family: "Cormorant Garamond", "Georgia", serif;
  font-weight: 500;
  font-size: 22px;
  color: var(--gd-ink);
  letter-spacing: -0.005em;
}
.gd-price-total .num {
  font-size: 28px;
  font-weight: 700;
  color: var(--gd-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.005em;
  line-height: 1;
}
.gd-price-total .num-sub {
  display: block;
  font-size: 11px;
  color: var(--gd-faint);
  font-weight: 500;
  text-align: right;
  margin-top: 4px;
  letter-spacing: 0.02em;
}

/* Pay CTA */
.gd-pay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-top: 20px;
  background: var(--gd-coral);
  color: #fff;
  border: 0;
  border-radius: 14px;
  padding: 16px 20px;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.005em;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(196, 90, 63,0.28), 0 1px 3px rgba(196, 90, 63,0.12);
  transition: all .2s ease;
}
.gd-pay:hover:not(:disabled) { background: var(--gd-coral-dark); }
.gd-pay[disabled] { background: #d4c6b8; color: #fff; cursor: not-allowed; box-shadow: none; }
.gd-pay .num { font-variant-numeric: tabular-nums; }
.gd-pay-microcopy {
  margin-top: 12px;
  font-size: 12px;
  color: var(--gd-muted);
  line-height: 1.5;
  text-align: center;
}
.gd-pay-microcopy b { color: var(--gd-ink); font-weight: 600; }

/* Trust band */
.gd-trust {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--gd-line);
  display: grid;
  gap: 10px;
}
.gd-trust-row {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  align-items: flex-start;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--gd-ink-soft);
}
.gd-trust-row svg { color: var(--gd-success); flex-shrink: 0; margin-top: 2px; }
.gd-trust-row b { color: var(--gd-ink); font-weight: 600; }
.gd-trust-row a { color: var(--gd-coral); font-weight: 600; text-decoration: none; }
.gd-trust--mobile { display: none; }
@media (max-width: 1023px) { .gd-trust--mobile { display: grid; } }

/* Pay rail */
.gd-pay-rail {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--gd-ivory);
  border: 1px solid var(--gd-line);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
}
.gd-pay-rail-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94755b;
}
.gd-pay-mark {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  background: #fff;
  border: 1px solid var(--gd-line);
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--gd-ink);
  letter-spacing: 0.04em;
}
.gd-pay-mark.razorpay { color: #072654; }
.gd-pay-rail--mobile { display: flex; }
@media (min-width: 1024px) { .gd-pay-rail--mobile { display: none; } }

/* Inline error banner */
.gd-banner {
  padding: 14px 16px;
  background: var(--gd-danger-bg);
  border: 1px solid var(--gd-danger-border);
  border-radius: 12px;
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 10px;
  font-size: 13px;
  color: #6b1e1a;
  line-height: 1.45;
  align-items: start;
  margin-top: 16px;
}
.gd-banner svg { color: var(--gd-danger); margin-top: 2px; }
.gd-banner b { color: #6b1e1a; font-weight: 700; }
.gd-banner a { color: var(--gd-danger); font-weight: 600; text-decoration: underline; }

/* Resume payment button */
.gd-resume-btn {
  background: none;
  border: none;
  color: var(--gd-coral);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  font-family: inherit;
}

/* Mobile sticky bottom bar */
.gd-mobile-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 50;
  background: rgba(255, 248, 231,0.97);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--gd-line);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  box-shadow: 0 -8px 24px rgba(26,26,46,0.08);
}
@media (min-width: 1024px) { .gd-mobile-bar { display: none; } }
.gd-mobile-bar-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}
.gd-mobile-bar-clock b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
  font-size: 15px;
  color: var(--gd-coral);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  line-height: 1;
}
.gd-mobile-bar-clock small {
  font-size: 10px;
  color: var(--gd-faint);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  margin-top: 3px;
}
.gd-mobile-bar-cta {
  background: var(--gd-coral);
  color: #fff;
  border: 0;
  border-radius: 12px;
  padding: 14px 16px;
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 4px 12px rgba(196, 90, 63,0.28);
}
.gd-mobile-bar-cta[disabled] { background: #d4c6b8; box-shadow: none; cursor: not-allowed; }
.gd-mobile-bar-cta .num { font-variant-numeric: tabular-nums; }
`;

export default GuestDetailsPage;
