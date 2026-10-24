import { feeAmount, paymentFeeCopy } from "../../utils/paymentFeeCopy";
/**
 * TASK-2612: GuestDetailsPage — step 2 of the two-step booking flow.
 *
 * FOUNDER RULED 2026-10-19: the 10-minute hold (which also closes the night on every OTA) starts when the guest
 * taps PAY, not at Reserve. UnitBookingWidget Reserve now only hands over the stay (listing, dates, guests, quote)
 * through BookingContext — no hold, no clock. This page collects the details and the required house-rules tick; at
 * Pay it re-checks the nights and starts the hold (POST /api/Razorpay/order, init-hold), then submits the
 * final-charge POST /api/Razorpay/order and opens the Razorpay modal. If the nights are gone it says so BEFORE any
 * money moves. "Try again" inside the window keeps the same hold; the countdown shows only while a hold is live.
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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Lock, ShieldCheck } from 'lucide-react';
import { useBooking, type BookingPriceBreakdown } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import { normalizePromoCodeInput } from '@/utils/promoCodeInput';
import {
  clampNationalDigits,
  getGuestDialOption,
  GUEST_DIAL_OPTIONS,
  toGuestPhoneE164,
  toRazorpayContactDigits,
} from '@/utils/guestPhoneDial';
import { getTenantContext } from '@/tenant/tenantContext';
import {
  hasOnlinePaymentRail,
  isTenantNotTakingBookings,
  isTenantTrialPayAtPropertyOnly,
  NOT_TAKING_BOOKINGS_COPY,
  TRIAL_PAY_AT_PROPERTY_COPY,
} from '@/tenant/paymentRail';
import { getGuestDataProcessingEntityName, getTenantBrandName } from '@/tenant/displayBrand';
import { formatCurrency } from '@/utils/formatting';
import { formatDateInTimezone } from '@/utils/dateHelpers';
import { TerminalCheckoutOutcomeEvents, track } from '@/lib/events';
import { mapRazorpayFailureCode } from '@/utils/razorpayGuestErrors';
import { failureDetailsFromRazorpayEvent, reportPaymentFailure } from '@/api/paymentFailureClient';
import { createRazorpayWindowWatch, isRazorpayContainerVisible } from '@/utils/razorpayWindowWatch';
import {
  isServerTotalConfirmRequired,
  razorpayOrderAmountInrToPaise,
} from '@/utils/razorpayOrderAmount';
import { formatDisplayNumber, getContactEmail, getTelLink, getWhatsAppLink } from '@/config/contact';
import { computeCheckoutTotal, discountPlugRow } from '@/utils/guestPriceEstimate';
import {
  buildRazorpayCheckoutDisplayConfig,
  isMobileCheckoutUserAgent,
} from '@/utils/razorpayCheckoutOptions';
import {
  resolveFreeCancellationTrustCopy,
  type FreeCancellationTrustCopy,
} from '@/utils/cancellationPolicy';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { FeeInfoTip } from '@/components/ui/FeeInfoTip';
import BookDirectPerks from '@/components/trust/BookDirectPerks';
import CancellationMilestoneTimeline from '@/components/booking/CancellationMilestoneTimeline';
import PricingTierDisplay from '@/components/pricing/PricingTierDisplay';
import { fetchListingById } from '@/api/listingClient';
import { fetchListingCheckoutInfo, type ListingCheckoutInfo } from '@/api/checkoutInfoClient';
import { HouseRulesAcceptance } from '@/components/checkout/HouseRulesAcceptance';
import { DormGenderAcknowledgement } from '@/components/hostel/DormGenderAcknowledgement';
import { dormNeedsGenderAcknowledgement, type DormGenderPolicy } from '@/utils/dormListing';
import { PaymentFailedPanel } from '@/components/checkout/PaymentFailedPanel';
import { UpiPaymentPanel } from '@/components/checkout/UpiPaymentPanel';
import { parseUpiOrder, type UpiOrder } from '@/utils/upiCheckout';
import { reportUpiPaid } from '@/api/payment';
import { buildHostFailureContact } from '@/utils/hostPaymentFailure';
import { getIstCalendarDate, toCalendarISO, istInstantFromCalendarDate } from '@/utils/date';
import { resolveListing } from '@/utils/listingResolver';
import { isMarketplaceMode } from '@/tenant/tenantResolver';
import { isProviderNotConfiguredError } from '@/components/availability/unitBookingPaymentOrderErrors';

/** TASK-5183: fire-and-forget hard-delete of PaymentPending draft when checkout is abandoned. */
function abandonPaymentPendingCheckout(
  bookingId: number | null | undefined,
  token: string | null | undefined,
  tenantSlug?: string | null,
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
      headers: getApiHeaders(tenantSlug),
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
/** TASK-2882: survive hard reload on GuestDetailsPage with a still-valid server hold. Since the 2026-10-19 founder
 *  ruling the cache holds the stay DRAFT (listing, dates, quote) from Reserve onward; the hold fields join it only
 *  once the guest has tapped Pay. */
const CHECKOUT_HOLD_KEY = 'atlas_guest_checkout_hold';
/** A stay draft untouched for this long is ignored on reload (the quote and the nights may have changed). */
const CHECKOUT_DRAFT_STALE_MS = 2 * 60 * 60 * 1000;
/** TASK-4296, TASK-4432, TASK-10298713: must match the API's CheckoutHoldConstants.HoldMinutes (10). Drives both the
 *  countdown progress baseline and the hold-expiry copy so they agree on the real duration. */
const CHECKOUT_HOLD_MINUTES = 10;

type CheckoutHoldCache = {
  /** Present only after the guest tapped Pay (the hold starts at Pay). */
  holdId?: number | null;
  holdExpiresAt?: string | null;
  holdToken?: string | null;
  /** ms since epoch of the last write; drives CHECKOUT_DRAFT_STALE_MS. */
  savedAt?: number;
  holdListingId?: number | null;
  holdPropertySlug?: string | null;
  holdUnitSlug?: string | null;
  holdTenantSlug?: string | null;
  holdListingName?: string | null;
  holdPriceBreakdown?: BookingPriceBreakdown | null;
  holdCancellationTier?: 'Flexible' | 'Moderate' | 'Strict' | null;
  holdCancellationWindowHours?: number | null;
  holdGraceHours?: number | null;
  /** HSL-011: the dorm's gender rule, so a reload keeps asking the tick. */
  holdDormGenderPolicy?: DormGenderPolicy | null;
  /** TASK-1039977 / PAY-006: refundable security deposit amount configured on listing. */
  holdSecurityDepositAmount?: number | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number;
  listingRatePlanId?: number | null;
  ratePlanName?: string | null;
};

function loadCheckoutHold(): CheckoutHoldCache | null {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_HOLD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutHoldCache;
    // Not a usable stay draft (older cache shape, or cleared): ignore it.
    if (!(parsed?.holdListingId || parsed?.holdId) || !parsed?.checkIn || !parsed?.checkOut) return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > CHECKOUT_DRAFT_STALE_MS) {
      window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY);
      return null;
    }
    // A lapsed hold is dropped but the draft stays: the guest taps Pay again, which re-checks the nights and
    // starts a fresh 10-minute hold.
    if (parsed.holdId && parsed.holdExpiresAt && new Date(parsed.holdExpiresAt).getTime() <= Date.now()) {
      return { ...parsed, holdId: null, holdExpiresAt: null, holdToken: null };
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

/**
 * TASK-102394: keep the focused checkout field above the mobile virtual keyboard.
 * iOS/Android keyboards can push the active input below the fold; scrolling the
 * field to viewport center on focus keeps what the guest types visible.
 */
function scrollFieldIntoView(e: React.FocusEvent<HTMLElement>) {
  try {
    e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    // jsdom / old webviews without scrollIntoView options — non-fatal.
  }
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

const normalizeDateParam = (val: string | null): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return istInstantFromCalendarDate(dateObj).toISOString();
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const GuestDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { propertySlug, unitSlug } = useParams<{ propertySlug: string; unitSlug: string }>();
  const { booking, updateBooking } = useBooking();
  const brandName = getTenantBrandName();
  const { currency, formatINR } = useCurrency();
  const [holdHydrationDone, setHoldHydrationDone] = useState(false);

  // TASK-10298987: Parse direct deep-link URL search params from router location.search (or window.location.search fallback)
  const urlParams = useMemo(() => {
    const search = location.search || (typeof window !== 'undefined' ? window.location.search : '');
    const sp = new URLSearchParams(search);
    const rawCheckIn = sp.get('checkIn') || sp.get('checkin');
    const rawCheckOut = sp.get('checkOut') || sp.get('checkout');
    const rawGuests = sp.get('guests');
    const rawListingId = sp.get('listingId') || sp.get('listing_id');
    const rawRatePlanId = sp.get('ratePlanId') || sp.get('listingRatePlanId');
    return {
      checkIn: normalizeDateParam(rawCheckIn),
      checkOut: normalizeDateParam(rawCheckOut),
      guests: rawGuests ? Math.max(1, parseInt(rawGuests, 10) || 1) : null,
      tenant: sp.get('tenant')?.trim() || null,
      listingId: rawListingId && !isNaN(Number(rawListingId)) ? Number(rawListingId) : null,
      ratePlanId: rawRatePlanId && !isNaN(Number(rawRatePlanId)) ? Number(rawRatePlanId) : null,
    };
  }, [location.search]);

  // TASK-2882 & TASK-10298987: hydrate the stay draft from URL query params (deep link) or sessionStorage
  // after a reload or direct deep-link before showing the "pick dates" modal.
  useEffect(() => {
    if (urlParams.checkIn && urlParams.checkOut) {
      const cached = loadCheckoutHold();
      const listingIdFromUnit = unitSlug && !isNaN(Number(unitSlug)) ? Number(unitSlug) : null;
      const effectiveListingId = urlParams.listingId ?? listingIdFromUnit ?? (cached?.holdListingId ?? null);

      updateBooking({
        checkIn: urlParams.checkIn,
        checkOut: urlParams.checkOut,
        guests: urlParams.guests ?? cached?.guests ?? booking.guests ?? 2,
        holdListingId: effectiveListingId,
        holdPropertySlug: propertySlug ?? cached?.holdPropertySlug ?? null,
        holdUnitSlug: unitSlug ?? cached?.holdUnitSlug ?? null,
        holdTenantSlug: urlParams.tenant ?? cached?.holdTenantSlug ?? booking.holdTenantSlug ?? null,
        listingRatePlanId: urlParams.ratePlanId ?? cached?.listingRatePlanId ?? null,
        ratePlanName: cached?.ratePlanName ?? null,
        holdPriceBreakdown: cached?.holdPriceBreakdown ?? null,
        holdCancellationTier: cached?.holdCancellationTier ?? null,
        holdCancellationWindowHours: cached?.holdCancellationWindowHours ?? null,
        holdGraceHours: cached?.holdGraceHours ?? null,
        holdDormGenderPolicy: cached?.holdDormGenderPolicy ?? null,
        holdSecurityDepositAmount: cached?.holdSecurityDepositAmount ?? null,
      });

      if (!effectiveListingId && unitSlug) {
        resolveListing(unitSlug, undefined, urlParams.tenant ?? booking.holdTenantSlug ?? null)
          .then((l) => {
            if (l?.id && !isNaN(Number(l.id))) {
              updateBooking({
                holdListingId: Number(l.id),
                holdListingName: l.name ?? null,
              });
            }
          })
          .catch(() => {});
      }
    } else if (!(booking.holdListingId || booking.holdId) || !booking.checkIn || !booking.checkOut) {
      const cached = loadCheckoutHold();
      if (cached) {
        updateBooking({
          holdId: cached.holdId ?? null,
          holdExpiresAt: cached.holdExpiresAt ?? null,
          holdToken: cached.holdToken ?? null,
          holdListingId: cached.holdListingId ?? null,
          holdPropertySlug: cached.holdPropertySlug ?? null,
          holdUnitSlug: cached.holdUnitSlug ?? null,
          holdTenantSlug: cached.holdTenantSlug ?? null,
          holdListingName: cached.holdListingName ?? null,
          holdPriceBreakdown: cached.holdPriceBreakdown ?? null,
          holdCancellationTier: cached.holdCancellationTier ?? null,
          holdCancellationWindowHours: cached.holdCancellationWindowHours ?? null,
          holdGraceHours: cached.holdGraceHours ?? null,
          holdDormGenderPolicy: cached.holdDormGenderPolicy ?? null,
          holdSecurityDepositAmount: cached.holdSecurityDepositAmount ?? null,
          checkIn: cached.checkIn ?? null,
          checkOut: cached.checkOut ?? null,
          guests: cached.guests ?? booking.guests,
          listingRatePlanId: cached.listingRatePlanId ?? null,
          ratePlanName: cached.ratePlanName ?? null,
        });
      }
    }
    setHoldHydrationDone(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only rehydrate

  // TASK-102391: warm the Razorpay SDK on mount so Pay opens instantly. Razorpay
  // renders an in-page iframe modal (never a popup window), so iOS popup blockers
  // do not apply — the real mobile failure mode is first-tap script-fetch latency
  // reading as "nothing happens". No-op callbacks: a failed preload simply falls
  // back to loading on Pay click via the existing path below.
  useEffect(() => {
    loadRazorpayScript(
      () => {},
      () => {},
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only preload

  // ── Hold state from context ──────────────────────────────────────────────
  const holdId = booking.holdId;
  const holdToken = booking.holdToken;
  const holdExpiresAt = booking.holdExpiresAt;
  const holdListingId = booking.holdListingId;
  const priceBreakdown = booking.holdPriceBreakdown;

  // TASK-102017: derive effective tenant slug from BookingContext hold state or URL search params
  const effectiveTenantSlug = booking.holdTenantSlug || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null);

  // Synchronize BookingContext and window.location query string if one was populated and the other missing
  useEffect(() => {
    if (booking?.holdTenantSlug && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (!sp.get('tenant')) {
        sp.set('tenant', booking.holdTenantSlug);
        const newUrl = `${window.location.pathname}?${sp.toString()}`;
        window.history.replaceState(null, '', newUrl);
      }
    } else if (!booking?.holdTenantSlug && typeof window !== 'undefined') {
      const urlTenant = new URLSearchParams(window.location.search).get('tenant');
      if (urlTenant) {
        updateBooking({ holdTenantSlug: urlTenant });
      }
    }
  }, [booking?.holdTenantSlug, updateBooking]);

  // TASK-8219: mirror the current hold identity into a ref so the pagehide/unmount abandon
  // guard (registered once, empty deps) always reads the latest holdId/holdToken without
  // needing to re-subscribe its event listeners on every hold change.
  const latestHoldRef = useRef<{ holdId: number | null; holdToken: string | null; holdTenantSlug: string | null; holdExpiresAt: string | null }>({
    holdId: null,
    holdToken: null,
    holdTenantSlug: null,
    holdExpiresAt: null,
  });
  useEffect(() => {
    latestHoldRef.current = {
      holdId: holdId ? Number(holdId) : null,
      holdToken: holdToken ?? null,
      holdTenantSlug: effectiveTenantSlug ?? null,
      holdExpiresAt: holdExpiresAt ?? null,
    };
  }, [holdId, holdToken, effectiveTenantSlug, holdExpiresAt]);

  // No stay draft (direct navigation, hard reload after a long break): instead of a silent redirect,
  // we render a "pick your dates again" card (see early return in Render) and keep the
  // guest's typed details, which are persisted to sessionStorage below.
  // FOUNDER RULED 2026-10-19: there is NO hold on arrival — the draft is the listing, dates and quote handed over by
  // Reserve. The hold (and its clock) exists only after the guest taps Pay.
  // TASK-10298987: if checkIn/checkOut are present in URL search params or in booking state,
  // hasDraft is true so direct deep links with search params never block the guest.
  const hasDraft = Boolean(
    ((holdListingId || holdId || (propertySlug && unitSlug)) && (booking.checkIn || urlParams.checkIn) && (booking.checkOut || urlParams.checkOut))
  );

  // ── Hold countdown (shown ONLY while a hold is live, i.e. during payment) ──────────────────────
  const [countdown, setCountdown] = useState(() =>
    holdExpiresAt ? formatCountdown(holdExpiresAt) : '0:00',
  );
  const [holdPct, setHoldPct] = useState(() =>
    holdExpiresAt ? remainingPct(holdExpiresAt) : 0,
  );
  const [holdExpired, setHoldExpired] = useState(false);
  const holdExpiredRef = useRef(false);
  useEffect(() => {
    holdExpiredRef.current = holdExpired;
  }, [holdExpired]);
  /** True while a 10-minute hold started at Pay is running. Drives every countdown / "dates held" element. */
  const holdLive = Boolean(holdId && holdExpiresAt) && !holdExpired;

  // TASK-4439: focus management for the blocking hold dialogs (WCAG 2.4.3 / 2.1.2)
  const noHoldDialogRef = useFocusTrap<HTMLDivElement>(
    holdHydrationDone && !hasDraft,
  );
  const expiredDialogRef = useFocusTrap<HTMLDivElement>(holdExpired);

  useEffect(() => {
    if (!holdExpiresAt) {
      // No live hold (before Pay, or just cleared): nothing counts down and nothing is "expired".
      setHoldExpired(false);
      setCountdown('0:00');
      setHoldPct(0);
      return;
    }
    // A fresh hold (new expiry) clears a previous lapse; tick() sets it again at once if already past.
    setHoldExpired(false);
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

  // ── Form state (GUEST-021: pre-fill from sessionStorage draft or saved localStorage/auth profile) ──
  const initialGuestProfile = useMemo(() => {
    const draft = loadCheckoutDraft();
    let savedName = '';
    let savedEmail = '';
    let savedPhoneRaw = '';
    try {
      savedName = window.localStorage.getItem('atlas_guest_name')?.trim() ?? '';
      savedEmail = window.localStorage.getItem('atlas_guest_email')?.trim() ?? '';
      savedPhoneRaw = window.localStorage.getItem('atlas_guest_phone')?.trim() ?? '';
      if (!savedEmail) {
        const rawAuth = window.localStorage.getItem('atlas_guest_auth');
        if (rawAuth) {
          const parsedAuth = JSON.parse(rawAuth) as { email?: string | null };
          if (parsedAuth?.email) savedEmail = parsedAuth.email.trim();
        }
      }
    } catch { /* ignore */ }

    let dialCode = typeof draft.phoneDialCode === 'string'
      && GUEST_DIAL_OPTIONS.some((o) => o.code === draft.phoneDialCode)
      ? draft.phoneDialCode
      : GUEST_DIAL_OPTIONS[0].code;

    let phoneDigits = typeof draft.phone === 'string' ? draft.phone : '';
    let usedSavedPhone = false;
    if (!phoneDigits && savedPhoneRaw) {
      usedSavedPhone = true;
      if (savedPhoneRaw.startsWith('+')) {
        const sortedOptions = [...GUEST_DIAL_OPTIONS].sort((a, b) => b.code.length - a.code.length);
        const matched = sortedOptions.find((o) => savedPhoneRaw.startsWith(o.code));
        if (matched) {
          dialCode = matched.code;
          phoneDigits = clampNationalDigits(savedPhoneRaw.slice(matched.code.length), matched.maxDigits);
        } else {
          phoneDigits = clampNationalDigits(savedPhoneRaw, GUEST_DIAL_OPTIONS[0].maxDigits);
        }
      } else {
        phoneDigits = clampNationalDigits(savedPhoneRaw, getGuestDialOption(dialCode).maxDigits);
      }
    }

    const draftName = typeof draft.name === 'string' ? draft.name : '';
    const draftEmail = typeof draft.email === 'string' ? draft.email : '';
    const usedSavedName = !draftName && Boolean(savedName);
    const usedSavedEmail = !draftEmail && Boolean(savedEmail);

    return {
      phoneDialCode: dialCode,
      name: draftName || savedName,
      email: draftEmail || savedEmail,
      phone: phoneDigits,
      nationality: typeof draft.nationality === 'string' && draft.nationality ? draft.nationality : 'India',
      notes: typeof draft.notes === 'string' ? draft.notes : '',
      prefilledFromSaved: usedSavedName || usedSavedEmail || usedSavedPhone,
    };
  }, []);

  const [phoneDialCode, setPhoneDialCode] = useState(() => initialGuestProfile.phoneDialCode);
  const [formData, setFormData] = useState(() => ({
    name: initialGuestProfile.name,
    email: initialGuestProfile.email,
    phone: initialGuestProfile.phone,
    nationality: initialGuestProfile.nationality,
    notes: initialGuestProfile.notes,
  }));
  const [isPrefilledFromSaved, setIsPrefilledFromSaved] = useState(
    () => initialGuestProfile.prefilledFromSaved,
  );

  const handleClearPrefilledGuestDetails = useCallback(() => {
    setFormData((p) => ({ ...p, name: '', email: '', phone: '' }));
    setFormErrors({ name: '', email: '', phone: '' });
    setIsPrefilledFromSaved(false);
    try {
      window.localStorage.removeItem('atlas_guest_name');
      window.localStorage.removeItem('atlas_guest_email');
      window.localStorage.removeItem('atlas_guest_phone');
      window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } catch { /* ignore */ }
  }, []);
  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [consentFlash, setConsentFlash] = useState(false);
  const consentRowRef = useRef<HTMLDivElement>(null);

  // FOUNDER RULED 2026-10-19: the house rules the guest must accept, and the host's OWN WhatsApp / phone for the
  // failed-payment fallback, both come from the LISTING OWNER (checkout-info) — never from the site's tenant, which on
  // the atlastays.com marketplace is the platform, and never Atlas's own number.
  const [checkoutInfo, setCheckoutInfo] = useState<ListingCheckoutInfo | null>(null);
  const [houseRulesAccepted, setHouseRulesAccepted] = useState(false);
  const [houseRulesError, setHouseRulesError] = useState('');
  const houseRulesRowRef = useRef<HTMLDivElement>(null);
  /** A listing with no host-written rules shows no tick and never blocks a booking on missing host data. */
  const houseRulesRequired = Boolean(checkoutInfo?.hasHouseRules);
  // HSL-011: a women-only / men-only dorm (policy straight from the listing API, carried by Reserve) needs a required
  // tick before Pay. It gates the Pay button and is sent as `dormGenderAcknowledged`; the API stores it with the listing's policy.
  const dormAckRequired = dormNeedsGenderAcknowledgement(booking.holdDormGenderPolicy);
  const [dormAckAccepted, setDormAckAccepted] = useState(false);
  const [dormAckError, setDormAckError] = useState('');
  const dormAckRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = holdListingId != null ? Number(holdListingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    const controller = new AbortController();
    void fetchListingCheckoutInfo(id, effectiveTenantSlug, controller.signal).then((info) => {
      if (!controller.signal.aborted) setCheckoutInfo(info);
    });
    return () => controller.abort();
  }, [holdListingId, effectiveTenantSlug]);

  // TASK-1039977 / PAY-006: Refundable security deposit resolution & consent
  const [listingSecurityDeposit, setListingSecurityDeposit] = useState<number | null>(null);

  useEffect(() => {
    const id = holdListingId != null ? Number(holdListingId) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    if (booking.holdSecurityDepositAmount != null) return;
    const ac = new AbortController();
    void fetchListingById(id, ac.signal)
      .then((l) => {
        if (!ac.signal.aborted) {
          const raw = l?.securityDepositAmount ?? (l as Record<string, unknown>)?.SecurityDepositAmount;
          const val = Number(raw);
          if (Number.isFinite(val) && val > 0) {
            setListingSecurityDeposit(val);
          }
        }
      })
      .catch(() => { /* non-critical */ });
    return () => ac.abort();
  }, [holdListingId, booking.holdSecurityDepositAmount]);

  const effectiveSecurityDepositAmount =
    booking.holdSecurityDepositAmount ??
    checkoutInfo?.securityDepositAmount ??
    listingSecurityDeposit ??
    null;

  const depositRequired =
    typeof effectiveSecurityDepositAmount === 'number' &&
    Number.isFinite(effectiveSecurityDepositAmount) &&
    effectiveSecurityDepositAmount > 0;

  const [depositAccepted, setDepositAccepted] = useState(false);
  const [depositError, setDepositError] = useState('');
  const depositRowRef = useRef<HTMLDivElement>(null);
  // TASK-10050 (DPDP guarded consent): transactional WhatsApp must NOT be pre-checked.
  // The previous `true` default meant consent was assumed unless the guest actively
  // opted out — a dark pattern that fails DPDP §6 "free, specific, informed" and
  // left the API with an unverifiable consent record. Default is now false; the
  // guest must explicitly check the box to opt in.
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
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
    // Persist the stay draft from Reserve onward (the hold fields join it once the guest has tapped Pay).
    if (!(holdListingId || holdId) || !booking.checkIn || !booking.checkOut) {
      try { window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY); } catch { /* ignore */ }
      return;
    }
    const payload: CheckoutHoldCache = {
      holdId: holdId ? Number(holdId) : null,
      holdExpiresAt: holdExpiresAt ?? null,
      holdToken: holdToken ?? null,
      savedAt: Date.now(),
      holdListingId: holdListingId ?? null,
      holdPropertySlug: booking.holdPropertySlug ?? propertySlug ?? null,
      holdUnitSlug: booking.holdUnitSlug ?? unitSlug ?? null,
      holdTenantSlug: booking.holdTenantSlug ?? effectiveTenantSlug ?? null,
      holdListingName: booking.holdListingName ?? null,
      holdPriceBreakdown: priceBreakdown ?? null,
      holdCancellationTier: booking.holdCancellationTier ?? null,
      holdCancellationWindowHours: booking.holdCancellationWindowHours ?? null,
      holdGraceHours: booking.holdGraceHours ?? null,
      holdDormGenderPolicy: booking.holdDormGenderPolicy ?? null,
      holdSecurityDepositAmount: booking.holdSecurityDepositAmount ?? null,
      checkIn: booking.checkIn ?? null,
      checkOut: booking.checkOut ?? null,
      guests: booking.guests,
      listingRatePlanId: booking.listingRatePlanId ?? null,
      ratePlanName: booking.ratePlanName ?? null,
    };
    try {
      window.sessionStorage.setItem(CHECKOUT_HOLD_KEY, JSON.stringify(payload));
    } catch { /* ignore */ }
  }, [
    holdId, holdToken, holdExpiresAt, holdListingId, priceBreakdown, booking.checkIn, booking.checkOut,
    booking.guests, booking.holdPropertySlug, booking.holdUnitSlug, booking.holdTenantSlug,
    booking.holdListingName, booking.holdCancellationTier, booking.holdCancellationWindowHours,
    booking.holdGraceHours, booking.holdDormGenderPolicy, booking.holdSecurityDepositAmount, booking.listingRatePlanId, booking.ratePlanName, propertySlug, unitSlug, effectiveTenantSlug,
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
        const res = await fetch(url, { headers: getApiHeaders(effectiveTenantSlug) });
        if (res.ok) {
          const data = (await res.json()) as AddOnService[];
          setAvailableAddOns(Array.isArray(data) ? data : []);
        }
      } catch { /* non-critical */ }
    })();
  }, [holdListingId, effectiveTenantSlug]);

  const stayGuestCount = booking.guests ?? 1;

  // ── Pricing ───────────────────────────────────────────────────────────────
  const baseAmount = priceBreakdown?.baseAmount ?? 0;
  const globalDiscountAmount = priceBreakdown?.discountAmount ?? 0;
  const convenienceFeeAmount = priceBreakdown?.convenienceFeeAmount ?? 0;
  // The widget's legacy estimate fallback may retain a positive fee for an absorbed hold.
  // Raw hold metadata drives only visible rows; total/payment calculation stays unchanged.
  const displayedFeeAmount = feeAmount(priceBreakdown?.paymentFeeDisplay?.amount) ?? convenienceFeeAmount;
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

  const { perNight, displayTotal } =
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

  // TASK-102392: the base row renders pre-discount `baseAmount` while the Total
  // nets the global discount, so lines and Total disagree whenever a discount
  // applies. Plug row reconciles them by construction (positive = discount,
  // negative = Total carries what rows do not show).
  const discountPlug = discountPlugRow(
    baseAmount + cleaningFeeAmount + touristTaxAmount + displayedFeeAmount,
    addOnsTotal - confirmedPromoDiscount - referralDiscountAmount,
    displayTotal,
  );

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
  /** Heading for the "pick different dates" banner. Null = the default "just booked" race wording; set for the host's own stay rules. */
  const [orderErrorHeading, setOrderErrorHeading] = useState<string | null>(null);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  /** FOUNDER RULED 2026-10-19: set by the first `payment.failed`; drives the "Payment didn't go through" panel. */
  const [paymentFailure, setPaymentFailure] = useState<{ reasonText: string; code: string; at: number } | null>(null);
  /** True once the order API said this listing's host cannot take an online payment (422 provider not configured). */
  const [hostOffline, setHostOffline] = useState(false);
  /** Funnel: `enter_contact` fires once per page visit, the first time the guest gets through the form and taps Pay. */
  const contactTrackedRef = useRef(false);
  /** Stable key so a lost response on the hold-start call can be retried without creating a second hold (TASK-8218). */
  const holdIdempotencyKeyRef = useRef<string | null>(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  // PAISE. The value the API hands us is RUPEES — see razorpayOrderAmountInrToPaise,
  // which is the single boundary where that conversion happens.
  const [razorpayAmountPaise, setRazorpayAmountPaise] = useState<number | null>(null);
  const pendingBookingTokenRef = useRef<string | null>(null);
  // TASK-8219: the Razorpay-order bookingId for the CURRENT in-flight attempt, kept in sync
  // wherever pendingBookingTokenRef is (the two places a server order response is applied).
  // Read by the pagehide/unmount abandon guard below, which runs outside the handleSubmit
  // closure and therefore cannot see its local `bookingId` variable.
  const pendingBookingIdRef = useRef<number | null>(null);
  // TASK-8219: true once this checkout has been explicitly resolved — payment succeeded, the
  // guest dismissed Razorpay, or tapped "back to property" — OR once the automatic
  // pagehide/visibilitychange/unmount guard has already fired an abandon call. Shared by every
  // abandon call site so a single guest departure can only ever produce one abandon-checkout POST.
  const checkoutSettledRef = useRef(false);
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
    /** PAISE — already converted at the order-response boundary. */
    amountPaise: number;
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

    // FOUNDER RULED 2026-10-19: "I accept the house rules" is required before Pay — when the host wrote rules.
    if (houseRulesRequired && !houseRulesAccepted) { setHouseRulesError('Please accept the house rules to continue.'); valid = false; }
    else { setHouseRulesError(''); }

    // HSL-011: women-only / men-only dorm - the guest must confirm the rule before Pay.
    if (dormAckRequired && !dormAckAccepted) { setDormAckError('Please confirm the dorm rule to continue.'); valid = false; }
    else { setDormAckError(''); }

    // TASK-1039977 / PAY-006: refundable security deposit consent
    if (depositRequired && !depositAccepted) { setDepositError('Please accept the refundable security deposit terms to continue.'); valid = false; }
    else { setDepositError(''); }

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
        if (dormAckRequired && !dormAckAccepted) {
          dormAckRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dormAckRowRef.current?.querySelector('input')?.focus();
          return;
        }
        if (depositRequired && !depositAccepted) {
          depositRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          depositRowRef.current?.querySelector('input')?.focus();
          return;
        }
        if (houseRulesRequired && !houseRulesAccepted) {
          houseRulesRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          houseRulesRowRef.current?.querySelector('input')?.focus();
          return;
        }
        if (!consentAccepted) {
          consentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          consentRowRef.current?.querySelector('input')?.focus();
        }
      });
    }
    return valid;
  }, [formData, phoneDialCode, consentAccepted, houseRulesRequired, houseRulesAccepted, dormAckRequired, dormAckAccepted, depositRequired, depositAccepted]);

  // ── Promo blur handler ────────────────────────────────────────────────────
  const handlePromoBlur = useCallback(async () => {
    const code = promoCode.trim();
    if (!code || !holdListingId) return;
    setPromoValidating(true);
    setPromoMessage(null);
    try {
      const res = await fetch(buildApiUrl('/api/promo-codes/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getApiHeaders(effectiveTenantSlug) },
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
  }, [promoCode, holdListingId, baseAmount, effectiveTenantSlug]);

  // ── Promo remove (TASK-102118) ──────────────────────────────────────────
  // 1-click remove behind the savings chip's (x) button. No dedicated
  // coupon-remove path exists — the input's onChange clearing IS the remove
  // path — so this replays exactly those state transitions, plus releases
  // the server-promo lock and drops the persisted seed so a reload cannot
  // reseed a deliberately-removed code. Pricing math untouched:
  // confirmedPromoDiscount derives from this same state.
  const handlePromoRemove = useCallback(() => {
    setPromoCode('');
    setPromoMessage(null);
    setAppliedPromoCode(null);
    setPromoDiscountAmount(0);
    setServerPromoLocked(false);
    try { window.localStorage.removeItem('atlas_guest_promo_code'); } catch { /* ignore */ }
  }, []);

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

  // ── Start the hold (at Pay) ──────────────────────────────────────────────────
  // FOUNDER RULED 2026-10-19: the 10-minute hold — which also closes the night on every OTA — starts when the guest taps Pay,
  // after the details and the required house-rules tick. The API re-checks the nights under the listing row lock and starts
  // the hold in one step; if the nights are gone it answers 409 AVAILABILITY_CONFLICT, which handleSubmit turns into
  // "Sorry, these dates were just booked" BEFORE any money moves. Errors propagate as the axios error so the caller's
  // catch can map them.
  const startHoldAtPay = useCallback(async (): Promise<{ holdId: number; holdToken: string | null; holdExpiresAt: string }> => {
    const listingIdNum = Number(holdListingId);
    if (!Number.isFinite(listingIdNum) || listingIdNum <= 0 || !booking.checkIn || !booking.checkOut) {
      throw new Error('We could not find your stay. Please go back and select dates again.');
    }
    // The context carries IST-midnight instants (see UnitBookingWidget); read them back as the IST civil date.
    const checkinDate = toCalendarISO(getIstCalendarDate(new Date(booking.checkIn)));
    const checkoutDate = toCalendarISO(getIstCalendarDate(new Date(booking.checkOut)));
    let key = holdIdempotencyKeyRef.current;
    if (!key) {
      key = crypto.randomUUID();
      holdIdempotencyKeyRef.current = key;
    }
    const response = await axios.post(
      buildApiUrl('/api/Razorpay/order'),
      {
        bookingDraft: {
          listingId: listingIdNum,
          checkinDate,
          checkoutDate,
          guests: booking.guests ?? 1,
          ...(booking.listingRatePlanId != null ? { listingRatePlanId: booking.listingRatePlanId } : {}),
        },
        currency: 'INR',
        // GuestInfo absent => init-hold mode on the API (it creates the hold; no Razorpay order yet).
        guestConsentAccepted: false,
      },
      { headers: getOrderRequestHeaders(key, effectiveTenantSlug), timeout: 15000 },
    );
    const { holdId: newHoldId, holdExpiresAt: newExpiry, prepToken } = response.data ?? {};
    if (!newHoldId || !newExpiry) {
      throw new Error('Hold could not be created. Please try again.');
    }
    holdIdempotencyKeyRef.current = null; // a later hold (after this one lapses) must not reuse this key
    checkoutSettledRef.current = false; // a new hold starts a new abandon/settle cycle
    const expiresIso = typeof newExpiry === 'string' ? newExpiry : new Date(newExpiry).toISOString();
    const token = typeof prepToken === 'string' ? prepToken : null;
    updateBooking({ holdId: Number(newHoldId), holdToken: token, holdExpiresAt: expiresIso });
    return { holdId: Number(newHoldId), holdToken: token, holdExpiresAt: expiresIso };
  }, [holdListingId, booking.checkIn, booking.checkOut, booking.guests, booking.listingRatePlanId, effectiveTenantSlug, updateBooking]);

  // ── PAY-010: UPI_QR / UPI_DEEPLINK checkout ──────────────────────────────────
  const [upiCheckout, setUpiCheckout] = useState<{
    order: UpiOrder;
    amountInr: number;
    bookingId: number;
    bookingToken: string | null;
  } | null>(null);
  const [upiReportBusy, setUpiReportBusy] = useState(false);
  const [upiReportError, setUpiReportError] = useState<string | null>(null);

  /** "I have paid": tell the host, then show the booking page's "waiting for the host to confirm" state. Never marks it paid. */
  const handleUpiIHavePaid = useCallback(async () => {
    if (!upiCheckout || upiReportBusy) return;
    setUpiReportBusy(true);
    setUpiReportError(null);
    try {
      await reportUpiPaid(upiCheckout.bookingId, upiCheckout.bookingToken, effectiveTenantSlug);
      try {
        sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
        sessionStorage.removeItem(CHECKOUT_HOLD_KEY);
      } catch { /* ignore */ }
      updateBooking({
        holdId: null, holdExpiresAt: null, holdPropertySlug: null,
        holdUnitSlug: null, holdTenantSlug: null, holdPriceBreakdown: null, holdListingId: null,
        holdListingName: null, holdCancellationTier: null,
        holdCancellationWindowHours: null, holdGraceHours: null,
        holdSecurityDepositAmount: null,
        paymentHoldBookingId: null, paymentHoldToken: null,
      });
      const token = upiCheckout.bookingToken;
      navigate(
        token
          ? `/booking/${upiCheckout.bookingId}?t=${encodeURIComponent(token)}`
          : `/booking/${upiCheckout.bookingId}`,
        { replace: true },
      );
    } catch (err) {
      setUpiReportError(err instanceof Error ? err.message : 'Could not tell the host. Please try again.');
    } finally {
      setUpiReportBusy(false);
    }
  }, [upiCheckout, upiReportBusy, effectiveTenantSlug, updateBooking, navigate]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // A lapsed hold (holdExpired) no longer blocks Pay: the next tap simply starts a fresh hold after re-checking the nights.
      if (isSubmitting) return;
      if (isTenantNotTakingBookings(getTenantContext())) {
        setOrderError(NOT_TAKING_BOOKINGS_COPY);
        return;
      }
      if (!validateForm()) return;
      // TASK-8048: fail closed before touching the network — a WHATSAPP / no-provider tenant must not reach POST /api/Razorpay/order.
      // 2026-10-19: also fail closed on the LISTING OWNER's own answer (checkout-info) — on the atlastays.com marketplace the
      // site's tenant is the platform, so a host with no payment provider looked payable and a guest reached the order API.
      if (!hasOnlinePaymentRail(getTenantContext()) || checkoutInfo?.onlinePaymentsAvailable === false) {
        setOrderError('Online payment is not available for this property. Please contact the host on WhatsApp to complete your booking.');
        return;
      }

      if (!hasDraft) {
        setOrderError('We could not find your stay. Please go back and select dates again.');
        return;
      }

      setIsSubmitting(true);
      setOrderError(null);
      setOrderErrorIs409(false);
      setOrderErrorHeading(null);
      setPaymentCancelled(false);
      setPaymentFailure(null);
      // Funnel: the guest got through name / phone / email / consents / house rules and tapped Pay.
      if (!contactTrackedRef.current) {
        contactTrackedRef.current = true;
        track('enter_contact', holdListingId ? Number(holdListingId) : 0);
      }

      const dial = getGuestDialOption(phoneDialCode);
      const e164Phone = toGuestPhoneE164(phoneDialCode, clampNationalDigits(formData.phone, dial.maxDigits));

      const selectedAddOnsList = availableAddOns
        .filter((ao) => (selectedAddOns[ao.addOnServiceId] ?? 0) > 0)
        .map((ao) => ({ addOnServiceId: ao.addOnServiceId, quantity: selectedAddOns[ao.addOnServiceId] }));

      // The final-charge body. holdId / holdToken are filled in below, once the hold exists (it may be started by this very tap).
      const buildPayload = (activeHoldId: number, activeHoldToken: string | null) => ({
        holdId: activeHoldId,
        // TASK-4354: prove ownership of the hold — server rejects a guessed holdId without this token.
        holdToken: activeHoldToken ?? undefined,
        currency: 'INR',
        guestConsentAccepted: consentAccepted,
        // FOUNDER RULED 2026-10-19: the server re-checks this when the listing has house rules.
        houseRulesAccepted,
        // HSL-011: the dorm gender-rule tick. The API requires it (400 DORM_GENDER_ACK_REQUIRED) on women-only / men-only dorms,
        // stores it with the policy it read from the listing, and ignores it everywhere else.
        dormGenderAcknowledged: dormAckAccepted,
        guestPurposeConsents: {
          booking_contact: consentAccepted,
          transactional_whatsapp: whatsappOptIn,
          marketing: marketingOptIn,
        },
        securityDepositAccepted: depositRequired ? depositAccepted : false,
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
          ...(booking.listingRatePlanId != null ? { listingRatePlanId: booking.listingRatePlanId } : {}),
        },
      });

      try {
        // ── FOUNDER RULED 2026-10-19: the 10-minute hold starts HERE, at Pay ─────────────────────────
        // Details and house rules carried no clock and closed no OTA night. A live hold is reused as is
        // ("Try again" keeps the same hold — no fresh clock per try). Otherwise the nights are re-checked and the
        // hold started right now; if the nights are gone the 409 below says so BEFORE any money moves.
        let activeHoldId: number | null = holdId != null ? Number(holdId) : null;
        let activeHoldToken: string | null = holdToken ?? null;
        let activeHoldExpiresAt: string | null = holdExpiresAt ?? null;
        const holdIsLive =
          activeHoldId != null &&
          activeHoldExpiresAt != null &&
          new Date(activeHoldExpiresAt).getTime() > Date.now() + 5_000;
        if (!holdIsLive) {
          // A lapsed hold takes its order with it: never reuse an order or a launch stashed for a released hold.
          pendingRazorpayLaunchRef.current = null;
          currentAttemptIdempotencyKeyRef.current = null;
          setServerTotalConfirmRequired(false);
          setRazorpayOrderId(null);
          const started = await startHoldAtPay();
          activeHoldId = started.holdId;
          activeHoldToken = started.holdToken;
          activeHoldExpiresAt = started.holdExpiresAt;
        }
        const numericHoldId = activeHoldId as number;
        const payload = buildPayload(numericHoldId, activeHoldToken);

        let keyId: string;
        let orderId: string;
        let bookingId: number;
        // PAISE throughout this function. The API returns RUPEES; the single conversion
        // sits at the order-response boundary below (razorpayOrderAmountInrToPaise).
        let amountPaise: number;
        let bookingToken: string | null = null;
        let idempotencyKey: string;

        const pendingLaunch = pendingRazorpayLaunchRef.current;
        if (pendingLaunch) {
          pendingRazorpayLaunchRef.current = null;
          setServerTotalConfirmRequired(false);
          ({ keyId, orderId, bookingId, amountPaise, bookingToken, idempotencyKey } = pendingLaunch);
          currentAttemptIdempotencyKeyRef.current = idempotencyKey;
          pendingBookingTokenRef.current = bookingToken;
          pendingBookingIdRef.current = bookingId; // TASK-8219: available to the pagehide/unmount abandon guard
          setRazorpayOrderId(orderId);
          setRazorpayAmountPaise(amountPaise);
        } else {
          // TASK-4536: Generate stable idempotency key for this attempt (same key across retries).
          let idempotencyKey = currentAttemptIdempotencyKeyRef.current;
          if (!idempotencyKey) {
            idempotencyKey = crypto.randomUUID();
            currentAttemptIdempotencyKeyRef.current = idempotencyKey;
          }
          // (start_checkout is tracked ONCE per stay, at Reserve — re-firing it on every Pay tap inflated "checkouts started".)

          const response = await axios.post(buildApiUrl('/api/Razorpay/order'), payload, {
            headers: getOrderRequestHeaders(idempotencyKey, effectiveTenantSlug),
            timeout: 20000,
          });
          const responseData = response.data;

          const {
            keyId: respKeyId,
            orderId: respOrderId,
            bookingId: respBookingId,
            bookingToken: respBookingToken,
            // RUPEES, despite the name — see razorpayOrderAmount.ts for why.
            amount: respAmountInr,
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
          if (!respAmountInr || typeof respAmountInr !== 'number' || respAmountInr <= 0) {
            console.error('[GuestDetailsPage] Invalid amount (INR):', respAmountInr);
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
          // ── UNIT BOUNDARY ──────────────────────────────────────────────────────
          // The API returns `amount` in RUPEES (RazorpayPaymentService.cs:658) even
          // though the Razorpay order it created is in PAISE
          // (RazorpayPaymentService.cs:575). Convert exactly once, here. Every
          // consumer below — the divergence gate, the "Total updated" banner, the
          // Pay CTA, the resume ref, the Razorpay checkout options — is in paise.
          // Do not "simplify" this call away; see src/utils/razorpayOrderAmount.ts.
          amountPaise = razorpayOrderAmountInrToPaise(Number(respAmountInr));
          bookingToken = typeof respBookingToken === 'string' ? respBookingToken.trim() : null;

          setRazorpayOrderId(orderId);
          setRazorpayAmountPaise(amountPaise);
          pendingBookingTokenRef.current = bookingToken;
          pendingBookingIdRef.current = bookingId; // TASK-8219: available to the pagehide/unmount abandon guard

          // PAY-010: a UPI_QR / UPI_DEEPLINK host gets no Razorpay order — show the UPI link / QR instead of launching
          // Razorpay with the host's UPI address as the key (which failed, so these guests could not pay at all). The
          // panel shows the amount the order charged, so the price shown is the price paid.
          const upiOrder = parseUpiOrder(responseData);
          if (upiOrder) {
            // The guest may pay from their UPI app at any moment from here on: never abandon (release) this hold from
            // the page. The server's 10-minute sweep still releases it if nobody says they paid.
            checkoutSettledRef.current = true;
            currentAttemptIdempotencyKeyRef.current = null;
            setUpiReportError(null);
            setUpiCheckout({ order: upiOrder, amountInr: Number(respAmountInr), bookingId, bookingToken });
            track('payment_init', holdListingId ? Number(holdListingId) : 0);
            setIsSubmitting(false);
            return;
          }

          if (isServerTotalConfirmRequired(amountPaise, displayTotal)) {
            pendingRazorpayLaunchRef.current = {
              keyId,
              orderId,
              bookingId,
              amountPaise,
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
                // GUEST-019: keep active hold on modal dismiss for retry; only abandon if expired.
                const holdStillActive =
                  !holdExpiredRef.current &&
                  (!latestHoldRef.current.holdExpiresAt ||
                    new Date(latestHoldRef.current.holdExpiresAt).getTime() > Date.now());
                if (!holdStillActive) {
                  checkoutSettledRef.current = true;
                  abandonPaymentPendingCheckout(bookingId, bookingToken ?? pendingBookingTokenRef.current, effectiveTenantSlug);
                }
                currentAttemptIdempotencyKeyRef.current = null;
                track(TerminalCheckoutOutcomeEvents.PaymentModalDismissed, holdListingId ? Number(holdListingId) : 0);
                setIsSubmitting(false);
                setPaymentCancelled(true);
                setRazorpayOrderId(null);
              };

              const options = {
                key: keyId,
                // Razorpay checkout expects the smallest currency unit (paise).
                amount: Number(amountPaise),
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
                  // TASK-8219: payment succeeded — there is no hold left to abandon, and the
                  // pagehide/unmount guard must not fire a stray abandon-checkout on the
                  // navigate-to-confirmation that follows.
                  checkoutSettledRef.current = true;
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
                          { headers: { ...getApiHeaders(effectiveTenantSlug), 'Content-Type': 'application/json' }, timeout: 15000 },
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
                      // TASK-10087: terminal outcome — anonymous identifiers only, no PII.
                      track(TerminalCheckoutOutcomeEvents.PaymentConfirmed, holdListingId ? Number(holdListingId) : 0);
                      updateBooking({
                        holdId: null, holdExpiresAt: null, holdPropertySlug: null,
                        holdUnitSlug: null, holdTenantSlug: null, holdPriceBreakdown: null, holdListingId: null,
                        holdListingName: null, holdCancellationTier: null,
                        holdCancellationWindowHours: null, holdGraceHours: null,
                        holdSecurityDepositAmount: null,
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
                    // TASK-10087: terminal outcome — anonymous identifiers only, no PII
                    // (payment/order IDs stay in the visible recovery message, never in the event).
                    track(TerminalCheckoutOutcomeEvents.ChargedUnconfirmed, holdListingId ? Number(holdListingId) : 0);
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
                          { headers: { Accept: 'application/json', ...getApiHeaders(effectiveTenantSlug) } },
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

              // TASK-4541: gate opening Razorpay if the hold has expired or insufficient time remains.
              // Uses the hold THIS tap is working with (it may have been started a moment ago), not the render's stale copy.
              const expiresAtIso = activeHoldExpiresAt as string;
              {
                const remainingMs = new Date(expiresAtIso).getTime() - Date.now();
                // Require ≥ 30 seconds remaining to open checkout (guest has time to pay)
                if (remainingMs < 30000) {
                  throw new Error(`Your hold ends in ${Math.max(0, Math.ceil(remainingMs / 1000))} seconds. Wait a few seconds, then tap Pay to start a fresh one.`);
                }
              }

              if (!window.Razorpay) {
                throw new Error('Razorpay SDK is not available. Please refresh and try again.');
              }

              type RazorpayCheckout = {
                open: () => void;
                close: () => void;
                on: (event: string, handler: (r: unknown) => void) => void;
              };
              const rzp = new window.Razorpay(options) as RazorpayCheckout;

              // TASK-4541: monitor hold expiry while payment modal is open and close on expiry
              // TASK-8222: hard-close the modal on expiry — the hold-expiry gate exists but without
              // closing Razorpay the guest can still pay into a released slot.
              const holdEndedDuringPayment = () => {
                paymentCompleted = true;
                checkoutSettledRef.current = true;
                try { rzp.close(); } catch { /* ignore */ }
                abandonPaymentPendingCheckout(bookingId, bookingToken ?? pendingBookingTokenRef.current, effectiveTenantSlug);
                // TASK-10087: terminal outcome — anonymous identifiers only, no PII.
                track(TerminalCheckoutOutcomeEvents.HoldExpiredDuringPayment, holdListingId ? Number(holdListingId) : 0);
                // The 10 minutes are over and the nights are released: drop the lapsed hold so the next Pay tap re-checks the
                // dates and starts a fresh one (the details the guest typed stay on the page).
                currentAttemptIdempotencyKeyRef.current = null;
                pendingRazorpayLaunchRef.current = null;
                setRazorpayOrderId(null);
                updateBooking({ holdId: null, holdToken: null, holdExpiresAt: null });
                setOrderError('Your 10 minutes ended while payment was in progress, so the dates were released. If your payment went through you will get a confirmation. Otherwise tap Pay and we will check the dates again.');
                setIsSubmitting(false);
              };
              const expireCheckInterval = setInterval(() => {
                const remainingMs = new Date(expiresAtIso).getTime() - Date.now();
                if ((holdExpiredRef.current || remainingMs <= 0) && !paymentCompleted) {
                  clearInterval(expireCheckInterval);
                  holdEndedDuringPayment();
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
                // TASK-10087: terminal outcome — anonymous identifiers only, no PII.
                track(TerminalCheckoutOutcomeEvents.PaymentFailed, holdListingId ? Number(holdListingId) : 0);
                // GUEST-028: keep what Razorpay said (and which website this ran on), so a refusal that blocks every guest is seen.
                reportPaymentFailure(bookingId, bookingToken ?? pendingBookingTokenRef.current, effectiveTenantSlug, {
                  ...failureDetailsFromRazorpayEvent(failRes),
                  orderId: orderId,
                });
                // FOUNDER RULED 2026-10-19: after the FIRST failed payment show "Payment didn't go through" with
                // [Try again] and [Message the host on WhatsApp]. The dates stay held until the 10-minute mark.
                setOrderError(null);
                setPaymentFailure({ reasonText: mapRazorpayFailureCode(code, desc), code, at: Date.now() });
                // TASK-2906: Store the order ID and amount so "Try again" can reuse the same order inside the window
                setRazorpayOrderId(orderId);
                setRazorpayAmountPaise(amountPaise);
                setPaymentCancelled(false);
                setIsSubmitting(false);
              });
              rzp.on('close', () => {
                clearInterval(expireCheckInterval);
                handleClose();
              });

              track('payment_init', holdListingId ? Number(holdListingId) : 0);
              rzp.open();

              // Razorpay's window can die without telling us (an in-app browser that blocks it, an order the gateway rejects): it alerts,
              // hides itself, and fires neither `close` nor `payment.failed`, which would leave Pay on "Securing your booking..." for the
              // rest of the hold. Give the guest the same way out as a failed payment: Try again, or the host on WhatsApp.
              const windowWatch = createRazorpayWindowWatch(Date.now());
              const openWatchdog = window.setInterval(() => {
                // `checkoutSettledRef` also flips when the guest leaves the page, so a departed guest never gets a late failure report.
                if (paymentCompleted || checkoutSettledRef.current) { window.clearInterval(openWatchdog); return; }
                if (!windowWatch.tick(isRazorpayContainerVisible(), Date.now())) return;
                window.clearInterval(openWatchdog);
                clearInterval(expireCheckInterval);
                paymentCompleted = true;
                track(TerminalCheckoutOutcomeEvents.PaymentFailed, holdListingId ? Number(holdListingId) : 0);
                reportPaymentFailure(bookingId, bookingToken ?? pendingBookingTokenRef.current, effectiveTenantSlug, {
                  code: 'CHECKOUT_DID_NOT_OPEN',
                  description: 'The Razorpay payment window did not open or closed without telling the page',
                  orderId,
                });
                setOrderError(null);
                setPaymentFailure({
                  reasonText: 'The payment window did not open in this browser. Try again, or open this page in Chrome or Safari.',
                  code: 'CHECKOUT_DID_NOT_OPEN',
                  at: Date.now(),
                });
                // The order Razorpay's window refused is not reused: "Try again" starts a fresh order on the SAME hold.
                setRazorpayOrderId(null);
                setPaymentCancelled(false);
                setIsSubmitting(false);
              }, 1000);
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
        const apiCode = typeof data?.code === 'string' ? data.code : '';

        if (isTimeout) {
          setOrderError('Payment initialization timed out. Please check your connection and try again.');
        } else if (isProviderNotConfiguredError(err)) {
          // The host cannot take an online payment (the API checks this BEFORE it holds the nights): hand the guest to the host.
          setHostOffline(true);
          setOrderError(null);
        } else if (status === 409 && apiCode === 'CHECKOUT_HOLD_EXPIRED') {
          // The 10 minutes ended before this call: the nights were released. Drop the lapsed hold; the next Pay tap re-checks the
          // dates and starts a fresh one. No money moved.
          updateBooking({ holdId: null, holdToken: null, holdExpiresAt: null });
          pendingRazorpayLaunchRef.current = null;
          currentAttemptIdempotencyKeyRef.current = null;
          setRazorpayOrderId(null);
          setOrderError('Your 10 minutes ended, so the dates were released. Tap Pay and we will check them again. No payment was taken.');
        } else if (status === 422 && apiCode === 'HOUSE_RULES_NOT_ACCEPTED') {
          setHouseRulesError('Please accept the house rules to continue.');
          setOrderError('Please accept the house rules to continue. No payment was taken.');
        } else if (status === 409 && apiCode === 'STAY_RULE_REFUSED') {
          // The host's own stay rule (minimum stay, closed to arrival, stop-sell, ...): the API's sentence is accurate and readable, and
          // nobody "got there first", so never say that. Nothing was held and no money moved.
          const ruleSentence = (serverMessage || 'These dates cannot be booked as chosen').trim().replace(/[.!?]+$/, '');
          setOrderError(`${ruleSentence}. Pick different dates to continue. No payment was taken.`);
          setOrderErrorHeading("These dates can't be booked as chosen.");
          setOrderErrorIs409(true);
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
            // FOUNDER RULED 2026-10-19: said at Pay, BEFORE any money moves.
            setOrderError(
              `Sorry, these dates were just booked. We couldn't hold ${datesLabel} — someone else got there first. Pick different dates to continue. No payment was taken.`,
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
      isSubmitting, validateForm, holdId, holdToken, holdExpiresAt, phoneDialCode, formData,
      availableAddOns, selectedAddOns, referralCode, promoCode, whatsappOptIn, marketingOptIn, consentAccepted,
      houseRulesAccepted, dormAckAccepted, depositRequired, depositAccepted, checkoutInfo, hasDraft, startHoldAtPay,
      holdListingId, updateBooking, navigate, booking.checkIn, booking.checkOut, displayTotal,
      checkInDisplay, checkOutDisplay, brandName, effectiveTenantSlug,
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
        { headers: { Accept: 'application/json', ...getApiHeaders(effectiveTenantSlug) } },
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
  }, [chargedUnconfirmedChecking, navigate, effectiveTenantSlug]);

  // Mobile: the sticky Pay bar can't show the desktop "tick consent" microcopy, so tapping
  // it while consent is unchecked scrolls the consent box into view and flashes it.
  const scrollToConsent = useCallback(() => {
    // HSL-011: the dorm rule tick sits above the house rules, so point at it first.
    if (dormAckRequired && !dormAckAccepted) {
      setDormAckError('Please confirm the dorm rule to continue.');
      dormAckRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // TASK-1039977 / PAY-006: refundable security deposit consent
    if (depositRequired && !depositAccepted) {
      setDepositError('Please accept the refundable security deposit terms to continue.');
      depositRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // The house-rules tick (when the host wrote rules) comes first on the page, so point at it first.
    if (houseRulesRequired && !houseRulesAccepted) {
      setHouseRulesError('Please accept the house rules to continue.');
      houseRulesRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setConsentError('Please accept the consent to continue.');
    consentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setConsentFlash(true);
    window.setTimeout(() => setConsentFlash(false), 1200);
  }, [houseRulesRequired, houseRulesAccepted, dormAckRequired, dormAckAccepted, depositRequired, depositAccepted]);

  // TASK-4537: Determine if the error message indicates a charged-but-unconfirmed state
  // that warrants showing clickable support affordance.
  const isChargedUnconfirmed = orderError && orderError.startsWith('Payment received but we could not confirm');

  const handleBackToProperty = useCallback(() => {
    // TASK-5183: leaving the details step must free the init-hold inventory.
    // TASK-8219: mark settled first so the pagehide/unmount guard (this click triggers an
    // in-SPA navigate() below, which unmounts the page) doesn't send a second abandon call.
    checkoutSettledRef.current = true;
    abandonPaymentPendingCheckout(holdId, holdToken ?? pendingBookingTokenRef.current, effectiveTenantSlug);
    try { window.sessionStorage.removeItem(CHECKOUT_HOLD_KEY); } catch { /* ignore */ }
    updateBooking({
      holdId: null, holdExpiresAt: null, holdPropertySlug: null,
      holdUnitSlug: null, holdTenantSlug: null, holdPriceBreakdown: null, holdListingId: null, holdListingName: null,
      holdCancellationTier: null, holdCancellationWindowHours: null, holdGraceHours: null,
      holdSecurityDepositAmount: null,
    });
    navigate(propertySlug && unitSlug ? `/homes/${propertySlug}/${unitSlug}` : '/', { replace: true });
  }, [updateBooking, navigate, propertySlug, unitSlug, holdId, holdToken, effectiveTenantSlug]);

  // FOUNDER RULED 2026-10-19: the 10 minutes after Pay are over and the nights are released. Drop the lapsed hold and keep
  // every detail on the page; the next Pay tap re-checks the dates and starts a fresh hold.
  const handleRestartHold = useCallback(() => {
    abandonPaymentPendingCheckout(holdId, holdToken ?? pendingBookingTokenRef.current, effectiveTenantSlug);
    pendingRazorpayLaunchRef.current = null;
    currentAttemptIdempotencyKeyRef.current = null;
    setServerTotalConfirmRequired(false);
    setRazorpayOrderId(null);
    setPaymentFailure(null);
    setPaymentCancelled(false);
    setOrderError(null);
    setOrderErrorIs409(false);
    updateBooking({ holdId: null, holdToken: null, holdExpiresAt: null });
  }, [holdId, holdToken, effectiveTenantSlug, updateBooking]);

  // TASK-8219: a guest who leaves /details via browser Back, mobile swipe-back, or tab-close
  // never routed through handleClose or handleBackToProperty, so abandonPaymentPendingCheckout
  // was never called and the 15-minute hold survived the guest's own abandonment.
  //
  //   - `pagehide` fires on real page discard (tab close, navigating to an external URL, or
  //     swipe-back past the app's own history root) and is the reliable signal Safari honours
  //     for a keepalive POST at teardown — NOT `beforeunload`, which mobile Safari drops.
  //   - `visibilitychange` → 'hidden' is the documented fallback for cases where `pagehide`
  //     itself is unreliable (iOS backgrounding a tab that is later evicted without ever
  //     re-foregrounding). It also fires on an ordinary tab switch, so it is debounced: the
  //     abandon only actually fires if the page is still hidden after HIDDEN_ABANDON_DELAY_MS,
  //     and is cancelled if the guest switches back before then.
  //   - The unmount cleanup below is the React-Router-native guard for in-SPA navigation away
  //     from /details (browser Back / swipe-back handled as a `popstate` route change, or any
  //     `navigate()` call) — the component unmounts without the page itself ever being
  //     discarded, so neither of the above fires. `useBlocker` (named in the task spec as the
  //     alternative) requires a data router (`createBrowserRouter`); this app mounts a plain
  //     `<BrowserRouter>` (src/App.tsx), so `useBlocker` would throw here — this cleanup is the
  //     guard that's actually available.
  //
  // All three routes share `checkoutSettledRef` with handleClose/handleBackToProperty/the
  // payment-success handler, so exactly one abandon-checkout call is ever sent per departure —
  // a duplicate on a live payment hold is its own defect.
  useEffect(() => {
    const HIDDEN_ABANDON_DELAY_MS = 3000;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const fireAbandonOnce = () => {
      if (checkoutSettledRef.current) return;
      checkoutSettledRef.current = true;
      const id = pendingBookingIdRef.current ?? latestHoldRef.current.holdId;
      const token = pendingBookingTokenRef.current ?? latestHoldRef.current.holdToken;
      abandonPaymentPendingCheckout(id, token, latestHoldRef.current.holdTenantSlug);
    };

    const handlePageHide = () => {
      if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
      fireAbandonOnce();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // GUEST-019: Do not abandon an active hold when the browser tab is backgrounded
        // (e.g., mobile guest switching to UPI app or SMS/bank OTP for 15-60s).
        // Real tab closes and navigations away are handled by pagehide and unmount;
        // if the guest never returns, the server-side hold TTL releases the slot automatically.
        const holdStillActive =
          !holdExpiredRef.current &&
          (!latestHoldRef.current.holdExpiresAt ||
            new Date(latestHoldRef.current.holdExpiresAt).getTime() > Date.now());
        if (holdStillActive) return;
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(fireAbandonOnce, HIDDEN_ABANDON_DELAY_MS);
      } else if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // In-SPA navigation away from /details unmounts this component without a pagehide event.
      fireAbandonOnce();
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!holdHydrationDone) {
    return (
      <div className="gd-page" aria-busy="true" aria-label="Loading your reservation">
        <style>{gdStyles}</style>
      </div>
    );
  }

  // No stay draft after rehydrate attempt — show pick-dates card (PII still in sessionStorage).
  if (!hasDraft) {
    return (
      <div className="gd-page">
        <div ref={noHoldDialogRef} className="gd-modal-shade" role="dialog" aria-modal="true" aria-labelledby="gd-nohold-title">
          <div className="gd-modal">
            <div className="gd-modal-icon"><IconClock size={22} /></div>
            <h3 id="gd-nohold-title">Let's pick your dates again</h3>
            <p>
              We couldn't find the stay you were booking (the page may have been open for a while). Pick your dates again
              — any details you entered are saved and will be waiting for you.
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
  // The HOST's own WhatsApp: the listing owner's checkout-info first; the site's own tenant number only when the site IS
  // the host's (never on the marketplace, where the site tenant is the platform). Never Atlas's default number.
  const siteHostWhatsapp = isMarketplaceMode() ? '' : (tenantCtx?.whatsappBookingPhone ?? '');
  // Once checkout-info has loaded it is the ONLY source (it already falls back to the owner's phone); the site number is used only
  // when checkout-info could not be loaded at all.
  const whatsappNumber = checkoutInfo ? (checkoutInfo.hostWhatsAppDigits ?? '') : siteHostWhatsapp;
  const consentEntityName = getGuestDataProcessingEntityName();
  // TASK-8048: single choke-point — do not offer a Razorpay pay rail when no online provider is configured.
  // hasOnlinePaymentRail() mirrors GET /tenants/from-domain's bookingMode derivation (TENANT vs WHATSAPP).
  // 2026-10-19: the LISTING OWNER's own answer (checkout-info, or the order API's refusal) also closes the rail, because on
  // the marketplace the site's tenant is the platform and says nothing about this host.
  const hasOnlineRail =
    hasOnlinePaymentRail(tenantCtx) && !hostOffline && checkoutInfo?.onlinePaymentsAvailable !== false;
  const notTakingBookings = isTenantNotTakingBookings(tenantCtx);
  const trialPayAtProperty = isTenantTrialPayAtPropertyOnly(tenantCtx);
  const whatsappHandoffUrl = (() => {
    const digits = (whatsappNumber || '').replace(/\D/g, '');
    const text = `Hi, I'm interested in booking ${propertyName || 'your property'}${unitName ? ` · ${unitName}` : ''} for ${checkInDisplay} → ${checkOutDisplay} (${nights} ${nights === 1 ? 'night' : 'nights'}, ${booking.guests ?? 1} guest${(booking.guests ?? 1) !== 1 ? 's' : ''}). Can you help me confirm?`;
    if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    // No host number known: on the host's own site the site contact is the host's; on the marketplace there is no safe number.
    return isMarketplaceMode() ? '' : `${getWhatsAppLink()}?text=${encodeURIComponent(text)}`;
  })();
  // FOUNDER RULED 2026-10-19: the failed-payment contact is the HOST's WhatsApp (pre-written with the room, dates, guests,
  // amount and the guest's name; the guest only taps Send), else a call link to the host's phone, else nothing.
  const failedPaymentContact = buildHostFailureContact({
    hostWhatsAppDigits: whatsappNumber,
    hostPhoneDigits: checkoutInfo ? checkoutInfo.hostPhoneDigits : (isMarketplaceMode() ? null : getTelLink().replace(/\D/g, '')),
    roomName: [propertyName, unitName].filter(Boolean).join(' · ') || null,
    checkInLabel: checkInDisplay,
    checkOutLabel: checkOutDisplay,
    nights,
    guests: booking.guests ?? 1,
    amountInr: chargeInr,
    guestName: formData.name,
  });
  // Charged-but-unconfirmed (the money WAS taken) keeps the site-level support links below; only the failed-payment panel is host-first.
  const paymentFailureWhatsAppUrl = `${getWhatsAppLink()}?text=${encodeURIComponent(
    'Hi, my payment went through but my booking is not confirmed yet. Can you help?',
  )}`;
  const paymentFailureTelLink = getTelLink();
  const paymentFailureEmail = getContactEmail();
  const paymentFailureMailto = `mailto:${paymentFailureEmail}?subject=${encodeURIComponent('Payment received — booking not confirmed')}`;

  /** Pay needs consent, house rules when present, dorm rule when present, and deposit consent when configured. */
  const readyToPay =
    consentAccepted &&
    (!houseRulesRequired || houseRulesAccepted) &&
    (!dormAckRequired || dormAckAccepted) &&
    (!depositRequired || depositAccepted);
  const payDisabled = isSubmitting || !readyToPay || notTakingBookings;

  return (
    <div className="gd-page">
      {/* ── Desktop hold strip (ink band below nav) ── */}
      <div className="gd-desktop-strip" data-testid="hold-strip">
        <div className="gd-desktop-strip-inner">
          <div className="gd-desktop-strip-left">
            <IconClock size={15}/>
            {holdLive ? (
              <span>
                Your dates are reserved for the next{' '}
                <b className="gd-strip-timer">{countdown}</b>.
                {'  '}Finish payment to confirm — if the time runs out the dates are released.
              </span>
            ) : (
              <span data-testid="hold-strip-no-clock">
                Take your time — nothing is held yet. Your dates are held for {CHECKOUT_HOLD_MINUTES} minutes only once you tap Pay.
              </span>
            )}
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
          {holdLive ? (
            <>
              <div className="gd-hold-title">
                Dates held for <b>{countdown}</b>
              </div>
              <div className="gd-hold-sub">Finish payment to lock them in</div>
            </>
          ) : (
            <>
              <div className="gd-hold-title" data-testid="hold-header-no-clock">Confirm your details</div>
              <div className="gd-hold-sub">Nothing is held until you tap Pay</div>
            </>
          )}
        </div>
        {holdLive && (
          <div className="gd-hold-track">
            <span style={{ width: (holdPct * 100) + '%' }} />
          </div>
        )}
      </div>

      {/* ── Hold expired modal (the 10 minutes after Pay ended) ──
          PAY-010: not over the UPI panel — a guest who already paid by UPI must still be able to tap "I have paid". */}
      {holdExpired && !upiCheckout && (
        <div ref={expiredDialogRef} className="gd-modal-shade" role="dialog" aria-modal="true" aria-labelledby="gd-expired-title">
          <div className="gd-modal">
            <div className="gd-modal-icon"><IconClock size={22}/></div>
            <h3 id="gd-expired-title">Your {CHECKOUT_HOLD_MINUTES} minutes are over.</h3>
            <p>
              The dates are open again for other guests. Your details are saved — tap below and we will check the dates
              again, then you can pay.
            </p>
            <button type="button" className="gd-modal-cta" onClick={handleRestartHold} data-testid="hold-expired-check-again">
              Check the dates again
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

          {/* GUEST-023: Branded Book Direct Perks */}
          <BookDirectPerks className="my-4" />

          {/* Guest form */}
          <form onSubmit={handleSubmit} noValidate id="gd-details-form">
            {/* Who's coming */}
            <div className="gd-fset" style={{ marginTop: 0 }}>
              <div className="gd-fset-head" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3>Who's coming</h3>
                  <small>Needed for booking &amp; police records</small>
                </div>
                {isPrefilledFromSaved && (
                  <button
                    type="button"
                    onClick={handleClearPrefilledGuestDetails}
                    data-testid="clear-prefilled-guest-details"
                    className="gd-pill"
                    style={{ cursor: 'pointer', border: '1px solid var(--gd-border, #e5d5c5)', background: 'transparent', fontSize: 12, padding: '2px 8px' }}
                  >
                    Saved details pre-filled · Clear
                  </button>
                )}
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-name">
                  <span>Full name <span aria-hidden="true" style={{ color: 'var(--gd-accent-text)', marginLeft: 4 }}>*</span></span>
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
                  onChange={(e) => { setFormData((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => ({ ...p, name: '' })); }}
                  onFocus={scrollFieldIntoView}
                  data-testid="guest-booking-name"
                />
                {formErrors.name && <div id="gd-name-error" className="gd-input-help error" role="alert">{formErrors.name}</div>}
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-email">
                  <span>Email <span aria-hidden="true" style={{ color: 'var(--gd-accent-text)', marginLeft: 4 }}>*</span></span>
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
                  onChange={(e) => { setFormData((p) => ({ ...p, email: e.target.value })); setFormErrors((p) => ({ ...p, email: '' })); }}
                  onFocus={scrollFieldIntoView}
                  data-testid="guest-booking-email"
                />
                <div id="gd-email-help" className="gd-input-help">Booking confirmation goes here</div>
                {formErrors.email && <div id="gd-email-error" className="gd-input-help error" role="alert">{formErrors.email}</div>}
              </div>

              <div className="gd-field">
                <label className="gd-field-label" htmlFor="gd-phone">
                  <span>Phone <span aria-hidden="true" style={{ color: 'var(--gd-accent-text)', marginLeft: 4 }}>*</span></span>
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
                      setFormErrors((p) => ({ ...p, phone: '' }));
                      const dial = getGuestDialOption(phoneDialCode);
                      setFormData((p) => ({
                        ...p,
                        phone: clampNationalDigits(e.target.value, dial.maxDigits),
                      }));
                    }}
                    onFocus={scrollFieldIntoView}
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
                  <span>Nationality <span style={{ color: 'var(--gd-accent-text)', marginLeft: 4 }}>*</span></span>
                </div>
                <div className="gd-dial">
                  <select
                    id="gd-nationality"
                    aria-label="Nationality"
                    aria-required="true"
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
                      <span style={{ color: 'var(--gd-accent-text)' }}><IconTag size={14}/></span>
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
                          setPromoCode(normalizePromoCodeInput(e.target.value));
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
                    {/* TASK-102118: celebratory green savings chip. Displays the
                        already-computed discount figure (promoDiscountAmount) —
                        never recomputed here. Remove reuses the existing
                        coupon-clear path (handlePromoRemove). */}
                    {!promoValidating && appliedPromoCode && promoDiscountAmount > 0 && (
                      <div data-testid="promo-savings-chip" role="status" className="gd-promo-chip">
                        <span>{appliedPromoCode} applied · You saved {displayPrice(promoDiscountAmount)}!</span>
                        <button
                          type="button"
                          onClick={handlePromoRemove}
                          aria-label={`Remove promo code ${appliedPromoCode}`}
                          data-testid="promo-savings-remove"
                          className="gd-promo-chip-x"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {promoValidating && <div className="gd-input-help">Checking code…</div>}
                    {!promoValidating && promoMessage && (
                      <div id="gd-promo-message" className={`gd-input-help${appliedPromoCode ? ' success' : ' error'}`} role={appliedPromoCode ? undefined : 'alert'}>
                        {promoMessage}
                      </div>
                    )}
                    {!promoValidating && !promoMessage && promoCode && (
                      <div className="gd-input-help">Codes are case-insensitive. Total updates after apply.</div>
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
                      <span style={{ color: 'var(--gd-accent-text)' }}><IconGift size={14}/></span>
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
                        <span style={{ color: 'var(--gd-accent-text)' }}><IconSparkles size={14}/></span>
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
                      <span style={{ color: 'var(--gd-accent-text)' }}><IconNote size={14}/></span>
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

            {/* GUEST-024: Visual cancellation policy milestone timeline */}
            <div className="mb-6">
              <CancellationMilestoneTimeline
                checkInDate={booking.checkIn}
                cancellationTier={booking.holdCancellationTier}
                windowHoursOverride={booking.holdCancellationWindowHours}
                graceHours={booking.holdGraceHours}
              />
            </div>

            {/* GUEST-025: Clear security deposit terms breakdown */}
            <div
              className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3 mb-6 shadow-xs"
              data-testid="security-deposit-terms"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-text-primary">Security Deposit Policy &amp; Terms</h3>
              </div>
              <p className="text-xs text-text-secondary">
                To protect against accidental damage and preserve property care, homestays may collect a standard security deposit.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border-subtle text-xs">
                <div className="bg-bg-muted p-3 rounded-xl border border-border-subtle">
                  <span className="font-semibold text-text-primary block mb-0.5">100% Refundable</span>
                  <span className="text-text-secondary">Fully refunded if no damages, excess cleaning, or policy violations occur during your stay.</span>
                </div>
                <div className="bg-bg-muted p-3 rounded-xl border border-border-subtle">
                  <span className="font-semibold text-text-primary block mb-0.5">Payment Method</span>
                  <span className="text-text-secondary">Collected securely via UPI, card link, or at check-in per host instructions (not charged on this hold).</span>
                </div>
                <div className="bg-bg-muted p-3 rounded-xl border border-border-subtle">
                  <span className="font-semibold text-text-primary block mb-0.5">Return Timeframe</span>
                  <span className="text-text-secondary">Inspected and credited back to your original payment method within 24–48 hours of checkout.</span>
                </div>
              </div>
            </div>

            {/* HSL-011: women-only / men-only dorm - REQUIRED rule tick before Pay. Renders nothing for any other listing. */}
            <div ref={dormAckRowRef}>
              <DormGenderAcknowledgement
                policy={booking.holdDormGenderPolicy}
                accepted={dormAckAccepted}
                onChange={(next) => { setDormAckAccepted(next); if (next) setDormAckError(''); }}
                error={dormAckError}
              />
            </div>

            {/* FOUNDER RULED 2026-10-19: the host's own house rules, with a REQUIRED "I accept" tick before Pay.
                Renders nothing when the host wrote no rules (a listing with no rules never blocks a booking). */}
            <div ref={houseRulesRowRef}>
              <HouseRulesAcceptance
                info={checkoutInfo}
                accepted={houseRulesAccepted}
                onChange={(next) => { setHouseRulesAccepted(next); if (next) setHouseRulesError(''); }}
                error={houseRulesError}
                variant="details"
              />
            </div>

            {/* PAY-006 / TASK-1039977: Refundable security deposit disclosure banner & consent */}
            {depositRequired && (
              <div
                ref={depositRowRef}
                className="gd-deposit-section"
                data-testid="security-deposit-banner"
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--gd-line-strong, #e2e8f0)',
                  background: 'var(--gd-surface-muted, #f8fafc)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <ShieldCheck size={20} style={{ color: 'var(--gd-accent, #0f766e)', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--gd-ink, #0f172a)' }}>
                      Refundable Security Deposit: {displayPrice(effectiveSecurityDepositAmount ?? 0)}
                    </h4>
                    <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gd-ink-soft, #475569)', lineHeight: 1.4 }}>
                      A refundable security deposit of <b>{displayPrice(effectiveSecurityDepositAmount ?? 0)}</b> is required for this stay.
                      This deposit covers incidental damages and is refunded after checkout inspection according to host policy.
                    </p>
                  </div>
                </div>

                <div
                  className={`gd-consent-row required${depositAccepted ? ' checked' : ''}`}
                  data-testid="guest-booking-deposit-consent-row"
                  style={{ marginTop: '0.5rem' }}
                >
                  <input
                    id="gd-deposit-consent"
                    type="checkbox"
                    checked={depositAccepted}
                    onChange={(e) => {
                      setDepositAccepted(e.target.checked);
                      if (e.target.checked) setDepositError('');
                    }}
                    aria-invalid={Boolean(depositError)}
                    aria-describedby={depositError ? 'gd-deposit-error' : undefined}
                    data-testid="guest-booking-deposit-consent"
                  />
                  <div className="gd-consent-body">
                    <label htmlFor="gd-deposit-consent">
                      I understand and accept the refundable security deposit of{' '}
                      <b>{displayPrice(effectiveSecurityDepositAmount ?? 0)}</b> for this stay.
                    </label>
                    <span className="gd-consent-tag">Required · Refundable Deposit Policy</span>
                  </div>
                </div>
                {depositError && (
                  <div id="gd-deposit-error" className="gd-input-help error" role="alert" style={{ marginTop: '0.25rem' }}>
                    {depositError}
                  </div>
                )}
              </div>
            )}

            {/* Native consent controls keep one focus stop per choice and independent policy links. */}
            <div className="gd-consent">
              <div ref={consentRowRef} className={`gd-consent-row required${consentAccepted ? ' checked' : ''}${consentFlash ? ' gd-consent-flash' : ''}`} data-testid="guest-booking-consent-row">
                <input id="gd-consent" type="checkbox" checked={consentAccepted}
                  onChange={(e) => { setConsentAccepted(e.target.checked); if (e.target.checked) setConsentError(''); }}
                  aria-invalid={Boolean(consentError)} aria-describedby={consentError ? 'gd-consent-error' : undefined}
                  data-testid="guest-booking-consent" />
                <div className="gd-consent-body">
                  <label htmlFor="gd-consent">I consent to <b>{consentEntityName}</b> collecting and using my name, phone, and email to process this booking and send booking-related communications.</label>{' '}
                  <Link to="/privacy" className="gd-consent-link">Privacy Policy</Link>{' '}&amp;{' '}
                  <Link to="/terms" className="gd-consent-link">Guest Terms</Link>.
                  <span className="gd-consent-tag">Required · booking &amp; contact · DPDP Act, 2023</span>
                </div>
              </div>
              {consentError && <div id="gd-consent-error" className="gd-input-help error" role="alert">{consentError}</div>}
              <div className={`gd-consent-row${whatsappOptIn ? ' checked' : ''}`} data-testid="guest-booking-whatsapp-consent-row">
                <input id="gd-whatsapp-consent" type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} data-testid="guest-booking-whatsapp-consent" />
                <label htmlFor="gd-whatsapp-consent" className="gd-consent-body">Send my booking updates on <b>WhatsApp</b> — confirmations, directions, host messages.{' '}
                  <span style={{ color: 'var(--gd-faint)' }}>(Optional — requires your explicit consent.)</span>
                </label>
              </div>
              <div className={`gd-consent-row${marketingOptIn ? ' checked' : ''}`} data-testid="guest-booking-marketing-consent-row">
                <input id="gd-marketing-consent" type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} data-testid="guest-booking-marketing-consent" />
                <label htmlFor="gd-marketing-consent" className="gd-consent-body">Send me promotional offers and deals from <b>{consentEntityName}</b>.{' '}
                  <span style={{ color: 'var(--gd-faint)' }}>(Optional — you can withdraw anytime from your preferences link.)</span>
                </label>
              </div>
            </div>

            {/* PAY-010: UPI_QR / UPI_DEEPLINK host — pay by UPI link / QR, then "I have paid" (host confirms). */}
            {upiCheckout && (
              <UpiPaymentPanel
                order={upiCheckout.order}
                amountInr={upiCheckout.amountInr}
                payeeName={getTenantContext()?.displayMerchantName ?? brandName}
                countdown={countdown}
                holdActive={holdLive}
                isMobile={isMobileCheckoutUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')}
                onIHavePaid={() => void handleUpiIHavePaid()}
                busy={upiReportBusy}
                error={upiReportError}
              />
            )}

            {/* FOUNDER RULED 2026-10-19: after the FIRST failed payment — "Payment didn't go through" with [Try again]
                and [Message the host on WhatsApp] (the HOST's number, pre-written; never Atlas's). */}
            {paymentFailure && !isSubmitting && (
              <PaymentFailedPanel
                reasonText={paymentFailure.reasonText}
                countdown={countdown}
                holdActive={holdLive}
                contact={failedPaymentContact}
                onTryAgain={() => {
                  setPaymentFailure(null);
                  // Same hold, same window: handleSubmit reuses a live hold and starts a new one only after the 10 minutes ended.
                  void handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
                variant="details"
              />
            )}

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
                      : isChargedUnconfirmed
                        ? 'Payment received — we\'re confirming your booking.'
                        : 'Something went wrong.'}
                  </b><br/>
                  <span>{orderError}</span>
                  {/* TASK-4537: Show a support affordance while a charged-but-unconfirmed payment is monitored.
                      (The plain "payment failed" case now has its own host-first panel above.) */}
                  {isChargedUnconfirmed && (
                    <div style={{ marginTop: 12 }} data-testid="payment-failed-support">
                      <p style={{ margin: '0 0 8px', fontSize: 14 }}>
                        {chargedUnconfirmedPollExhausted
                          ? 'Automatic checks have paused — tap Check again or reach out if you need help.'
                          : 'We\'re still checking automatically — no need to pay again.'}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="gd-resume-btn"
                          onClick={() => { void handleChargedUnconfirmedRecheck(); }}
                          disabled={chargedUnconfirmedChecking}
                          data-testid="charged-unconfirmed-recheck"
                        >
                          {chargedUnconfirmedChecking ? 'Checking…' : 'Check again'}
                        </button>
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
                  <b>{orderErrorHeading || 'Sorry, these dates were just booked.'}</b><br/>
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
                  <b style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--gd-accent-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{countdown}</b>.
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

          {/* Security badges (mobile only — desktop in aside). Gated on the online rail:
              never on the TASK-8048 WhatsApp-handoff branch. */}
          {hasOnlineRail && <SecurityBadges className="gd-sec--mobile" />}

          {/* Trust band (mobile only — desktop in aside) */}
          <TrustBand
            feeCopy={paymentFeeCopy(priceBreakdown?.paymentFeeDisplay ?? { percent: null, amount: priceBreakdown?.convenienceFeeAmount })}
            freeCancellationCopy={freeCancellationCopy}
            brandName={brandName}
            whatsappNumber={whatsappNumber}
            className="gd-trust--mobile"
          />
        </div>

        {/* ── Right: sticky aside ── */}
        <aside className="gd-aside">
          {/* Hold chip in aside */}
          {holdLive ? (
            <div className="gd-hold-chip">
              <div className="gd-hold-chip-clock">{countdown}</div>
              <div className="gd-hold-chip-text">
                <b>Dates held</b><br/>
                Finish to confirm
              </div>
            </div>
          ) : (
            <div className="gd-hold-chip" data-testid="aside-no-hold-chip">
              <div className="gd-hold-chip-text">
                <b>Nothing is held yet</b><br/>
                We hold your dates for {CHECKOUT_HOLD_MINUTES} minutes when you tap Pay
              </div>
            </div>
          )}

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
            {/* TASK-1039948: Direct booking pricing tier public display */}
            {(booking.ratePlanName || booking.ratePlanMealPlan || booking.ratePlanCancellationPolicy || freeCancellationCopy) && (
              <div style={{ marginBottom: 6 }}>
                <PricingTierDisplay
                  ratePlanName={booking.ratePlanName}
                  mealPlanLabel={booking.ratePlanMealPlan}
                  cancellationPolicy={booking.ratePlanCancellationPolicy || freeCancellationCopy?.deadlineFormatted}
                  isCompact
                />
              </div>
            )}
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
              <div className="gd-price-row" data-testid="cleaning-fee-row">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Cleaning fee
                  {/* TASK-102113: (?) tooltip with the generic host-policy explanation — hover on desktop, tap popover on mobile. */}
                  <FeeInfoTip fee="cleaning" label="Cleaning fee" testId="fee-info-cleaning" />
                </span>
                <span className="num">{displayPrice(cleaningFeeAmount)}</span>
              </div>
            )}
            {addOnsTotal > 0 && (
              <div className="gd-price-row">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Add-on services
                  {/* TASK-102113: (?) tooltip — hover on desktop, tap popover on mobile. */}
                  <FeeInfoTip fee="addOns" label="Add-on services" testId="fee-info-addons" />
                </span>
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
            {touristTaxAmount > 0 && (
              <div className="gd-price-row" data-testid="tourist-tax-row">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Tourist tax
                  {/* TASK-102113: (?) tooltip — hover on desktop, tap popover on mobile. */}
                  <FeeInfoTip fee="touristTax" label="Tourist tax" testId="fee-info-tourist-tax" />
                </span>
                <span className="num">{displayPrice(touristTaxAmount)}</span>
              </div>
            )}
            {displayedFeeAmount > 0 && (
              <div className="gd-price-row" title="Razorpay payment gateway fee — passed through, not a platform markup.">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Payment processing
                  {/* TASK-102113: (?) tooltip — hover on desktop, tap popover on mobile.
                      The row `title` is kept as a native-hover fallback. */}
                  <FeeInfoTip fee="paymentProcessing" label="Payment processing" testId="fee-info-payment-processing" />
                </span>
                <span className="num">{displayPrice(displayedFeeAmount)}</span>
              </div>
            )}
            {/* TASK-102392: plug row so the visible lines sum exactly to the Total.
                Positive = a global discount the base row already netted out; negative
                = the Total carries an amount not shown by any row above. */}
            {discountPlug !== 0 && (
              <div className={`gd-price-row${discountPlug > 0 ? ' save' : ''}`} data-testid="price-line-discount-plug">
                <span>{discountPlug > 0 ? 'Discount' : 'Other charges'}</span>
                <span className="num">{discountPlug > 0 ? '−' : ''}{displayPrice(Math.abs(discountPlug))}</span>
              </div>
            )}
          </div>

          <div className="gd-price-total">
            <span className="label">Total</span>
            <div style={{ textAlign: 'right' }}>
              <div className="num">{displayPrice(displayTotal)}</div>
              <small className="num-sub" data-testid="checkout-total-gst-note">
                INR
              </small>
            </div>
          </div>

          {/* PAY-006 / TASK-1039977: Refundable security deposit breakdown line in aside */}
          {depositRequired && (
            <div
              className="gd-deposit-recap"
              data-testid="security-deposit-breakdown"
              style={{
                marginTop: '0.75rem',
                marginBottom: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--gd-surface-muted, #f8fafc)',
                border: '1px solid var(--gd-line, #e2e8f0)',
                fontSize: '0.85rem',
                color: 'var(--gd-ink-soft, #475569)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, color: 'var(--gd-ink, #0f172a)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Refundable security deposit
                  <FeeInfoTip fee="securityDeposit" label="Refundable security deposit" testId="fee-info-security-deposit" />
                </span>
                <span>{displayPrice(effectiveSecurityDepositAmount ?? 0)}</span>
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--gd-ink-faint, #64748b)' }}>
                Held separately per host policy · Refundable upon checkout inspection
              </div>
            </div>
          )}

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

          {/* Pay CTA — TASK-8048: do not render a Razorpay pay rail when no online provider is configured. */}
          {hasOnlineRail ? (
            <>
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
              {!readyToPay && (
                <div className="gd-pay-microcopy">
                  {dormAckRequired && !dormAckAccepted
                    ? 'Confirm the dorm rule and tick the consent box to enable payment.'
                    : depositRequired && !depositAccepted
                      ? 'Tick the refundable security deposit agreement to enable payment.'
                      : houseRulesRequired && !houseRulesAccepted && !consentAccepted
                        ? 'Tick the house rules and the consent box to enable payment.'
                        : houseRulesRequired && !houseRulesAccepted
                          ? 'Tick the house rules to enable payment.'
                          : 'Tick the consent box to enable payment.'}
                </div>
              )}
              {readyToPay && (
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

              {/* Security badges — gated on the online rail: never rendered on the
                  TASK-8048 WhatsApp-handoff branch where there is no gateway to claim. */}
              <SecurityBadges />
            </>
          ) : notTakingBookings ? (
            <>
              <div className="gd-banner" role="status" data-testid="guest-not-taking-bookings-notice">
                <IconAlert size={16}/>
                <div>
                  <b>{NOT_TAKING_BOOKINGS_COPY}</b><br/>
                  <span>Checkout is currently disabled for this property.</span>
                </div>
              </div>
              <button
                type="button"
                className="gd-pay"
                disabled
                data-testid="guest-booking-disabled-cta"
              >
                Not taking bookings right now
              </button>
            </>
          ) : (
            <>
              <div className="gd-banner" role="status" data-testid="guest-booking-offline-notice">
                <IconWhatsApp size={16}/>
                <div>
                  <b>Online payment is not available for this property.</b><br/>
                  <span>Contact the host on WhatsApp to confirm your dates.</span>
                  {trialPayAtProperty && (
                    <div data-testid="guest-trial-pay-at-property-notice" style={{ marginTop: 4 }}>
                      {TRIAL_PAY_AT_PROPERTY_COPY}
                    </div>
                  )}
                </div>
              </div>
              {whatsappHandoffUrl ? (
                <>
                  <a
                    href={whatsappHandoffUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gd-pay"
                    style={{ textDecoration: 'none' }}
                    data-testid="guest-booking-whatsapp-cta"
                  >
                    <IconWhatsApp size={16}/> WhatsApp host to confirm
                  </a>
                  <div className="gd-pay-microcopy">You'll be connected directly to the host — no payment taken on this site.</div>
                </>
              ) : (
                <div className="gd-pay-microcopy" data-testid="guest-booking-no-host-number">
                  Please contact the host directly to make a reservation.
                </div>
              )}
            </>
          )}

          {/* GUEST-024: Cancellation policy milestone timeline in checkout summary */}
          <CancellationMilestoneTimeline
            checkInDate={booking.checkIn}
            cancellationTier={booking.holdCancellationTier}
            windowHoursOverride={booking.holdCancellationWindowHours}
            graceHours={booking.holdGraceHours}
            className="mb-4"
          />

          {/* Trust band (desktop) */}
          <TrustBand
            feeCopy={paymentFeeCopy(priceBreakdown?.paymentFeeDisplay ?? { percent: null, amount: priceBreakdown?.convenienceFeeAmount })}
            freeCancellationCopy={freeCancellationCopy}
            brandName={brandName}
            whatsappNumber={whatsappNumber}
          />
        </aside>
      </main>

      {/* ── Mobile sticky bottom bar — TASK-8048: offline tenants show WhatsApp CTA, not a pay rail. */}
      <div className="gd-mobile-bar">
        {holdLive && (
          <div className="gd-mobile-bar-clock">
            <b>{countdown}</b>
            <small>Held</small>
          </div>
        )}
        {hasOnlineRail ? (
          <button
            type={readyToPay ? 'submit' : 'button'}
            form="gd-details-form"
            className="gd-mobile-bar-cta"
            disabled={isSubmitting}
            onClick={readyToPay ? undefined : scrollToConsent}
            data-testid="guest-booking-submit-mobile"
          >
            {isSubmitting
              ? <><IconSpinner size={14}/> Securing…</>
              : serverTotalConfirmRequired
                ? <><IconLock size={14}/> Confirm <span className="num">{displayPrice(chargeInr)}</span></>
                : <><IconLock size={14}/> Pay <span className="num">{displayPrice(chargeInr)}</span></>
            }
          </button>
        ) : notTakingBookings ? (
          <button
            type="button"
            className="gd-mobile-bar-cta"
            disabled
            data-testid="guest-booking-disabled-cta-mobile"
          >
            Not taking bookings right now
          </button>
        ) : whatsappHandoffUrl ? (
          <a
            href={whatsappHandoffUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gd-mobile-bar-cta"
            style={{ textDecoration: 'none' }}
            data-testid="guest-booking-whatsapp-cta-mobile"
          >
            <IconWhatsApp size={14}/> WhatsApp host
          </a>
        ) : (
          <button type="button" className="gd-mobile-bar-cta" disabled data-testid="guest-booking-no-host-number-mobile">
            Contact the host directly
          </button>
        )}
      </div>

      <style>{gdStyles}</style>
    </div>
  );
};

// ── TrustBand atom ────────────────────────────────────────────────────────────
interface TrustBandProps {
  feeCopy: string;
  freeCancellationCopy: FreeCancellationTrustCopy | null;
  brandName: string;
  whatsappNumber: string;
  className?: string;
}
const TrustBand: React.FC<TrustBandProps> = ({ freeCancellationCopy, brandName, whatsappNumber, className, feeCopy }) => (
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
      {/* TASK-7428: Payment copy only when an online payment provider is configured. */}
      <span>
        {hasOnlinePaymentRail()
          ? <>Direct booking · secure payment via Razorpay · <b>no OTA fee</b> · {feeCopy}</>
          : <>Direct booking with the host · <b>no OTA fee</b></>}
      </span>
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

// ── SecurityBadges atom (TASK-102074) ──────────────────────────────────────
// Rendered ONLY while an online payment rail exists (caller gates on hasOnlineRail).
// Claims are tied to the Razorpay gateway (privacy.ts:91 "RBI-regulated"), so rendering
// on the TASK-8048 WhatsApp-handoff branch would be a false security claim.
interface SecurityBadgesProps {
  className?: string;
}
const SecurityBadges: React.FC<SecurityBadgesProps> = ({ className }) => (
  <div className={`gd-sec${className ? ` ${className}` : ''}`} data-testid="guest-checkout-security-badges">
    <span className="gd-sec-label">Secure checkout</span>
    <div className="gd-sec-row">
      <span className="gd-sec-pill"><Lock size={12}/> 256-Bit SSL Encrypted</span>
      <span className="gd-sec-pill"><ShieldCheck size={12}/> RBI-Regulated Gateway</span>
      <span className="gd-sec-pill"><IconCheck size={12}/> Instant Booking Confirmation</span>
    </div>
  </div>
);

// ── Inline styles — verbatim .gd-* tokens from bundle styles.css ─────────────
const gdStyles = `
@keyframes gd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

:root {
  --gd-ink: #3b1f1e;
  --gd-ink-soft: #5c3d3c;
  --gd-muted: #6b4a48;
  --gd-faint: #8a6a68;
  --gd-ivory: #fefcf9;
  --gd-linen: #fde0c8;
  --gd-peach: #f5c8b0;
  --gd-line: rgba(59, 31, 30, 0.12);
  --gd-line-strong: rgba(59, 31, 30, 0.20);
  --gd-coral: var(--cta-primary, #c04528);
  --gd-accent-text: #a83c22;
  --gd-coral-dark: var(--cta-primary-hover, #a83c22);
  --gd-amber: #d4724e;
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
  color: var(--gd-accent-text);
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
  color: var(--gd-accent-text);
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
  color: var(--gd-accent-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.gd-modal h3 {
  color: var(--gd-ink);
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
  color: var(--text-on-cta, #fff);
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
  color: var(--gd-accent-text);
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
  color: var(--gd-ink);
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
  border-color: var(--gd-accent-text);
  box-shadow: 0 0 0 4px rgba(196, 90, 63,0.12);
}
.gd-input--error { border-color: var(--gd-danger) !important; }
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
.gd-input--error-wrap .gd-input { border-color: var(--gd-accent-text); }

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
  border-color: var(--gd-accent-text);
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
  color: var(--gd-accent-text);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

/* TASK-102118: celebratory green savings chip after a coupon applies */
.gd-promo-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px 10px 14px;
  background: var(--gd-success-bg);
  border: 1px solid var(--gd-success-border);
  border-radius: 12px;
  color: var(--gd-success);
  font-size: 13.5px;
  font-weight: 700;
  animation: gd-chip-pop .25s ease-out;
}
.gd-promo-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
  border: 1px solid var(--gd-success-border);
  border-radius: 999px;
  background: #fff;
  color: var(--gd-success);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}
@keyframes gd-chip-pop {
  from { opacity: 0; transform: scale(.96) translateY(-2px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .gd-promo-chip { animation: none; }
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
  color: var(--text-on-cta, #fff);
}
.gd-check svg { opacity: 0; }
.gd-check.checked svg { opacity: 1; }

/* Consent block */
.gd-consent { margin-top: 22px; display: grid; gap: 12px; }
/* TASK-102395: consent rows are full-card tap targets — never less than 48px
   even if padding is restyled, so touch users can't hit a 12px-hitbox trap. */
.gd-consent-row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 12px;
  padding: 14px 16px;
  min-height: 48px;
  align-items: center;
  border: 1.5px solid var(--gd-line-strong);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color .18s ease;
  position: relative;
}
.gd-consent-row input { width: 22px; height: 22px; accent-color: var(--gd-coral); cursor: pointer; }
.gd-consent-row label { cursor: pointer; display: inline-block; min-height: 44px; align-content: center; }
.gd-consent-row:focus-within { outline: 2px solid var(--gd-ink); outline-offset: 3px; }
.gd-consent-row.required { border-color: var(--gd-accent-text); background: #fff8f2; }
.gd-consent-row.checked { border-color: var(--gd-success); background: var(--gd-success-bg); }
.gd-consent-flash { animation: gd-consent-flash 1.2s ease-out; }
@keyframes gd-consent-flash {
  0%   { box-shadow: 0 0 0 0 rgba(196, 90, 63, 0); }
  25%  { box-shadow: 0 0 0 4px rgba(196, 90, 63, 0.35); }
  100% { box-shadow: 0 0 0 0 rgba(196, 90, 63, 0); }
}
.gd-consent-body { font-size: 13px; color: var(--gd-ink-soft); line-height: 1.5; }
.gd-consent-body b { color: var(--gd-ink); font-weight: 600; }
.gd-consent-link { color: var(--gd-accent-text); font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
.gd-consent-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--gd-accent-text);
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
  color: var(--gd-ink);
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

/* Pay CTA — use tenant fill/label together; neutral body and error text stay readable. */
.gd-pay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  margin-top: 20px;
  background: var(--gd-coral);
  color: var(--text-on-cta, #fff);
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
.gd-pay[disabled] { background: #d4c6b8; color: #493a32; cursor: not-allowed; box-shadow: none; }
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
.gd-trust-row a { color: var(--gd-accent-text); font-weight: 600; text-decoration: none; }
.gd-trust--mobile { display: none; }
@media (max-width: 1023px) { .gd-trust--mobile { display: grid; } }

/* Security badges (TASK-102074) */
.gd-sec {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.gd-sec-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #765b45;
}
.gd-sec-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
.gd-sec-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  background: var(--gd-ivory);
  border: 1px solid var(--gd-line);
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--gd-ink-soft);
  line-height: 1.2;
  white-space: nowrap;
}
.gd-sec-pill svg { color: var(--gd-success); flex-shrink: 0; }
.gd-sec--mobile { display: none; }
@media (max-width: 1023px) { .gd-sec--mobile { display: flex; } }

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
  color: #765b45;
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

/* Founder ruling 2026-10-19: house rules card (required tick before Pay) */
.gd-rules {
  margin-top: 22px;
  padding: 16px;
  border: 1px solid var(--gd-line-strong);
  border-radius: 14px;
  background: #fff;
  display: grid;
  gap: 10px;
}
.gd-rules-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--gd-ink); }
.gd-rules-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.gd-rules-chip {
  font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--gd-line-strong); color: var(--gd-ink-soft); background: var(--gd-ivory);
}
.gd-rules-chip--no { color: #8a2a17; background: #fff1ec; border-color: #f1c2b3; }
.gd-rules-chip--ok { color: var(--gd-success); background: var(--gd-success-bg); border-color: var(--gd-success-border); }
.gd-rules-text { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--gd-ink-soft); white-space: pre-line; }
.gd-rules-more { background: none; border: none; padding: 0; color: var(--gd-accent-text); font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: underline; }
.gd-rules-pdf { margin: 0; font-size: 13px; }
.gd-rules-pdf a { color: var(--gd-accent-text); font-weight: 600; }
.gd-rules .gd-consent-row { margin-top: 2px; }

/* Founder ruling 2026-10-19: "Payment didn't go through" panel (Try again + message the host) */
.gd-banner.gd-fail { grid-template-columns: 1fr; padding: 16px; }
.gd-fail-title { display: block; font-size: 16px; margin-bottom: 2px; }
.gd-fail-sub, .gd-fail-hold, .gd-fail-note { display: block; }
.gd-fail-hold { margin-top: 4px; font-weight: 600; }
.gd-fail-note { margin-top: 8px; font-size: 12px; color: var(--gd-muted); }
.gd-fail-actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.gd-fail-try {
  min-height: 44px; padding: 0 20px; border-radius: 10px; border: none; cursor: pointer;
  background: var(--gd-coral); color: #fff; font-weight: 700; font-size: 14px;
}
.gd-fail-try:disabled { opacity: .6; cursor: default; }
.gd-banner a.gd-fail-host {
  min-height: 44px; padding: 0 18px; border-radius: 10px; display: inline-flex; align-items: center;
  border: 1.5px solid var(--gd-ink); color: var(--gd-ink); background: #fff; text-decoration: none; font-weight: 700; font-size: 14px;
}

/* Resume payment button */
.gd-resume-btn {
  background: none;
  border: none;
  color: var(--gd-accent-text);
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
  color: var(--gd-accent-text);
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
  color: var(--text-on-cta, #fff);
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
.gd-mobile-bar-cta[disabled] { background: #d4c6b8; color: #493a32; box-shadow: none; cursor: not-allowed; }
.gd-mobile-bar-cta .num { font-variant-numeric: tabular-nums; }
`;

export default GuestDetailsPage;
