import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { getApiBaseUrl } from '@/runtime-config';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import { fetchGuestPriceBreakdown, netChargeableRoomFare, type GuestPriceBreakdown } from '@/api/pricingClient';
import { getIstCalendarDate, toCalendarISO } from '@/utils/date';
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';
import { formatCurrency } from '@/utils/formatting';
import { razorpayOrderAmountInrToPaise } from '@/utils/razorpayOrderAmount';

// ── Types ───────────────────────────────────────────────────────────────────

type EmbedListingSummary = {
  id: number;
  name: string;
  propertyId: number;
  propertyName: string | null;
  maxGuests: number;
  baseNightlyRate: number | null;
  coverPhotoUrl: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  timezoneId: string | null;
  securityDepositAmount: number | null;
};

type EmbedConfig = {
  tenantId: number;
  tenantSlug: string;
  tenantName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  tagline?: string | null;
  isLiveEligible: boolean;
  websiteState: string;
  blocker?: string | null;
  publishedListingsCount: number;
  listings: EmbedListingSummary[];
};

type Step = 'select' | 'dates' | 'details' | 'confirmed';

type BookingResult = {
  bookingId: number;
  bookingToken: string | null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseHexChannels(hex: string): [number, number, number] | null {
  const match = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const full = match[1].length === 3 ? match[1].split('').map((c) => `${c}${c}`).join('') : match[1];
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function luminanceFromRgb(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const CTA_DARK = '#111827';
const CTA_DARK_LUM = luminanceFromRgb(0x11, 0x18, 0x27); // 0.00918
const CTA_WHITE_LUM = 1.0;

export function readableCtaText(background: string): string {
  const channels = parseHexChannels(background);
  if (!channels) return 'var(--text-on-cta, #ffffff)';
  const lum = luminanceFromRgb(channels[0], channels[1], channels[2]);
  const contrastWhite = contrastRatio(lum, CTA_WHITE_LUM);
  const contrastDark = contrastRatio(lum, CTA_DARK_LUM);
  // Pick the higher-contrast option; threshold alone leaves a dead band where neither reaches 4.5.
  return contrastWhite >= contrastDark ? '#ffffff' : CTA_DARK;
}

// TASK-10170: dead band L in (0.18333,0.21631) where neither #fff nor #111827 reaches 4.5:1.
// The CTA background itself must be nudged out of the band. We blend the original brand
// toward black (for white text) or toward white (for dark text) in 1% steps and return the
// first hex that clears 4.5 with its optimal text colour. The step granularity keeps the
// shift minimal and hue largely intact.
export function clampedBrandColor(background: string): string {
  const channels = parseHexChannels(background);
  if (!channels) return background;
  const [r, g, b] = channels;
  const lum = luminanceFromRgb(r, g, b);
  const cw = contrastRatio(lum, CTA_WHITE_LUM);
  const cd = contrastRatio(lum, CTA_DARK_LUM);
  if (cw >= 4.5 || cd >= 4.5) return background;

  // Search both directions; prefer the smallest t that reaches 4.5.
  const blend = (t: number, target: 'black' | 'white'): [number, number, number] => {
    if (target === 'black') {
      return [Math.round(r * (1 - t)), Math.round(g * (1 - t)), Math.round(b * (1 - t))];
    }
    return [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t)];
  };

  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    for (const target of ['black', 'white'] as const) {
      const [nr, ng, nb] = blend(t, target);
      const nlum = luminanceFromRgb(nr, ng, nb);
      const nWhite = contrastRatio(nlum, CTA_WHITE_LUM);
      const nDark = contrastRatio(nlum, CTA_DARK_LUM);
      if (nWhite >= 4.5 || nDark >= 4.5) {
        const hex = `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
        return hex;
      }
    }
  }
  return background;
}

export function ctaStyle(background: string): { background: string; color: string } {
  const bg = clampedBrandColor(background);
  return { background: bg, color: readableCtaText(bg) };
}

// TASK-10178 part 1: on select -> dates -> details -> confirmed, the previous step unmounts
// (including the button just activated), focus falls to <body>, and nothing is announced --
// the file's only live region (the pre-config loading state) is long gone by then. Rather than
// threading a focus ref through four separately-defined sub-components, a single persistent
// (never unmounted) status region reports each transition in words; only its TEXT changes,
// which is the reliable way to get assistive tech to actually announce it.
export function stepAnnouncementText(step: Step, listingCount: number): string {
  switch (step) {
    case 'select': return listingCount > 1 ? 'Choose a stay' : 'Loading stay details';
    case 'dates': return 'Choose your dates and number of guests';
    case 'details': return 'Enter your details to complete the booking';
    case 'confirmed': return 'Booking confirmed';
    default: return '';
  }
}

function normalizeConfig(raw: Record<string, unknown>): EmbedConfig {
  const g = (camel: string, pascal: string) => raw[camel] ?? raw[pascal];
  const listingsRaw = (g('listings', 'Listings') ?? []) as Record<string, unknown>[];
  return {
    tenantId: Number(g('tenantId', 'TenantId')),
    tenantSlug: String(g('tenantSlug', 'TenantSlug') ?? ''),
    tenantName: String(g('tenantName', 'TenantName') ?? ''),
    logoUrl: (g('logoUrl', 'LogoUrl') as string) ?? null,
    brandColor: (g('brandColor', 'BrandColor') as string) ?? null,
    tagline: (g('tagline', 'Tagline') as string) ?? null,
    isLiveEligible: Boolean(g('isLiveEligible', 'IsLiveEligible')),
    websiteState: String(g('websiteState', 'WebsiteState') ?? 'Unknown'),
    blocker: (g('blocker', 'Blocker') as string) ?? null,
    publishedListingsCount: Number(g('publishedListingsCount', 'PublishedListingsCount') ?? 0),
    listings: listingsRaw.map((r) => ({
      id: Number(r.id ?? r.Id),
      name: String(r.name ?? r.Name ?? ''),
      propertyId: Number(r.propertyId ?? r.PropertyId),
      propertyName: (r.propertyName ?? r.PropertyName) as string | null,
      maxGuests: Number(r.maxGuests ?? r.MaxGuests ?? 2),
      // TASK-10180 defect 2: the guard used to test only the camelCase key
      // (`r.baseNightlyRate != null`), so a PascalCase-only payload short-circuited to null even
      // though the assignment itself already fell back to `r.BaseNightlyRate` -- every sibling
      // field in this object checks both casings before deciding null vs a value; this one must too.
      baseNightlyRate: (r.baseNightlyRate ?? r.BaseNightlyRate) != null ? Number(r.baseNightlyRate ?? r.BaseNightlyRate) : null,
      coverPhotoUrl: (r.coverPhotoUrl ?? r.CoverPhotoUrl) as string | null,
      checkInTime: (r.checkInTime ?? r.CheckInTime) as string | null,
      checkOutTime: (r.checkOutTime ?? r.CheckOutTime) as string | null,
      timezoneId: (r.timezoneId ?? r.TimezoneId) as string | null,
      securityDepositAmount: r.securityDepositAmount != null || r.SecurityDepositAmount != null
        ? Number(r.securityDepositAmount ?? r.SecurityDepositAmount)
        : null,
    })),
  };
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function fetchAvailability(
  listingId: number,
  from: string,
  to: string,
): Promise<Map<string, string>> {
  const url = new URL(buildApiUrl(`/api/public/listings/${listingId}/availability-calendar`));
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  const res = await fetch(url.toString(), { headers: getApiHeaders() });
  if (!res.ok) return new Map();
  const days = (await res.json()) as unknown;
  if (!Array.isArray(days)) return new Map();
  const map = new Map<string, string>();
  for (const d of days as Record<string, unknown>[]) {
    const date = String(d.date ?? d.Date ?? '').slice(0, 10);
    const status = String(d.status ?? d.Status ?? 'available');
    if (date) map.set(date, status);
  }
  return map;
}

// TASK-10168: same posture as UnitBookingWidget's dateStatusMap/blockedSet treatment (see
// src/components/availability/UnitBookingWidget.tsx:242-248) -- Blocked and Hold nights are
// never bookable; Turnover (same-day checkout/checkin) and Available are. A night with no
// entry in the map (never fetched, or the fetch failed) fails CLOSED: it is NOT available.
function isNightBookable(status: string | undefined): boolean {
  return status === 'Available' || status === 'Turnover';
}

// Every night from checkIn (inclusive) to checkOut (exclusive) must be individually bookable.
function isRangeBookable(map: Map<string, string>, checkIn: Date, checkOut: Date): boolean {
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (!isNightBookable(map.get(format(d, 'yyyy-MM-dd')))) return false;
  }
  return true;
}

// ── Razorpay script loader ──────────────────────────────────────────────────

let razorpayPromise: Promise<boolean> | null = null;
function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  if (razorpayPromise) return razorpayPromise;
  razorpayPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => { razorpayPromise = null; resolve(false); };
    document.head.appendChild(script);
  });
  return razorpayPromise;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ListingSelector({
  listings,
  onSelect,
}: {
  listings: EmbedListingSummary[];
  onSelect: (listing: EmbedListingSummary) => void;
}) {
  return (
    <div data-testid="embed-listing-select">
      {/* TASK-10180 defect 3: the parent only ever mounts ListingSelector when
          config.listings.length > 1 (see the `step === 'select' && config.listings.length > 1`
          guard below), so a `listings.length === 1` branch here could never run. Removed rather
          than left as dead code overstating the state machine. */}
      <div className="mb-3 grid gap-2">
        {listings.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onSelect(l)}
            className="flex items-center gap-3 rounded-lg border border-border-subtle p-3 text-left transition-colors hover:border-border-default"
          >
            {l.coverPhotoUrl && (
              <img src={l.coverPhotoUrl} alt={l.name} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{l.name}</div>
              {l.propertyName && <div className="truncate text-xs text-text-secondary">{l.propertyName}</div>}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                {l.baseNightlyRate != null && <span>{formatCurrency(l.baseNightlyRate)}/night</span>}
                <span>{l.maxGuests} guests max</span>
              </div>
            </div>
            <span className="text-lg text-text-muted">&#8250;</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DateGuestPicker({
  listing,
  onConfirm,
  brand,
}: {
  listing: EmbedListingSummary;
  onConfirm: (checkIn: Date, checkOut: Date, guests: number) => void;
  brand: string;
}) {
  const today = useMemo(() => getIstCalendarDate(), []);
  const maxDate = useMemo(() => addDays(today, 365), [today]);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  // TASK-10179: `listing.maxGuests` can be malformed (normalizeConfig's `?? 2` fallback lets an
  // API-supplied literal `0` straight through, since `??` only catches null/undefined) and the
  // guest count used to default to a bare `useState(2)` with no relation to the listing at all.
  // Both the option list below and the initial state are now folded through the SAME floor, so
  // the select's bound value can never land outside its own option set: effectiveMaxGuests is
  // at least 1 even when the listing's maxGuests is 0, and the initial guest count is clamped
  // into [1, effectiveMaxGuests] instead of defaulting to a value the options list may not
  // contain (a single-occupancy listing previously stayed stuck at guests=2, which the server
  // then rejected as > listing.MaxGuests).
  const effectiveMaxGuests = Math.max(listing.maxGuests, 1);
  const [guests, setGuests] = useState(() => Math.min(2, effectiveMaxGuests));
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [availError, setAvailError] = useState(false);
  const [availability, setAvailability] = useState<Map<string, string> | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingAvail(true);
    setAvailError(false);
    // Fetch the FULL pickable window (today..maxDate), not a shorter slice -- a truncated
    // fetch would leave everything past its end with no map entry, which the fail-closed
    // check below would then (correctly, but uselessly) treat as unbookable.
    const from = format(today, 'yyyy-MM-dd');
    const to = format(maxDate, 'yyyy-MM-dd');
    fetchAvailability(listing.id, from, to)
      .then((map) => {
        if (cancelled) return;
        setAvailability(map);
        setLoadingAvail(false);
      })
      .catch(() => {
        // TASK-10168 defect 2: fetchAvailability's own fetch has no .catch, so a network
        // rejection (DNS/offline/CORS/abort) never reached setLoadingAvail(false) and the
        // CTA stayed "Checking availability..." and disabled forever. `availability` stays
        // null here (fail CLOSED) rather than being set to an empty Map.
        if (cancelled) return;
        setAvailError(true);
        setLoadingAvail(false);
      });
    return () => { cancelled = true; };
  }, [listing.id, today, maxDate, retryToken]);

  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;
  const rangeSelected = Boolean(checkIn && checkOut && nights > 0 && guests >= 1);
  // TASK-10168 defect 1: the resolved map used to be discarded entirely, so every date in
  // the year was selectable regardless of occupancy. Every night in the selected range must
  // now be individually confirmed bookable.
  const rangeBookable = rangeSelected && checkIn && checkOut && availability != null
    && isRangeBookable(availability, checkIn, checkOut);
  const canSubmit = rangeSelected && !loadingAvail && !availError && rangeBookable;

  const handleCtaClick = () => {
    if (availError) { setRetryToken((n) => n + 1); return; }
    if (canSubmit && checkIn && checkOut) onConfirm(checkIn, checkOut, guests);
  };

  return (
    <div data-testid="embed-date-guest">
      <label htmlFor="embed-checkin-date" className="mb-1 block text-xs font-medium text-text-secondary">Check-in</label>
      <input
        id="embed-checkin-date"
        type="date"
        data-testid="embed-checkin-date"
        value={checkIn ? format(checkIn, 'yyyy-MM-dd') : ''}
        min={format(today, 'yyyy-MM-dd')}
        max={format(maxDate, 'yyyy-MM-dd')}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
          setCheckIn(d);
          if (d && checkOut && d >= checkOut) setCheckOut(null);
        }}
        className="mb-2 w-full rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
      />

      <label htmlFor="embed-checkout-date" className="mb-1 block text-xs font-medium text-text-secondary">Check-out</label>
      <input
        id="embed-checkout-date"
        type="date"
        data-testid="embed-checkout-date"
        value={checkOut ? format(checkOut, 'yyyy-MM-dd') : ''}
        min={checkIn ? format(addDays(checkIn, 1), 'yyyy-MM-dd') : format(addDays(today, 1), 'yyyy-MM-dd')}
        max={format(maxDate, 'yyyy-MM-dd')}
        onChange={(e) => {
          setCheckOut(e.target.value ? new Date(e.target.value + 'T00:00:00') : null);
        }}
        className="mb-2 w-full rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
      />

      {checkIn && checkOut && (
        <div className="mb-2 text-xs text-text-muted">{formatNightCount(nights)}</div>
      )}

      {rangeSelected && !loadingAvail && !availError && !rangeBookable && (
        <div role="alert" className="mb-2 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          Some of the selected nights aren&apos;t available. Please choose different dates.
        </div>
      )}

      {availError && (
        <div role="alert" className="mb-2 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          Couldn&apos;t check availability. Please retry before continuing.
        </div>
      )}

      <label htmlFor="embed-guests" className="mb-1 block text-xs font-medium text-text-secondary">Guests</label>
      <select
        id="embed-guests"
        value={guests}
        onChange={(e) => setGuests(parseInt(e.target.value, 10) || 2)} // eslint-disable-line atlas/no-coerce-numeric-onchange -- select element, cannot be cleared
        className="mb-3 w-full rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
      >
        {Array.from({ length: Math.min(effectiveMaxGuests, 16) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n} guest{n === 1 ? '' : 's'}</option>
        ))}
      </select>

      <button
        type="button"
        disabled={!availError && (!canSubmit || loadingAvail)}
        onClick={handleCtaClick}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={ctaStyle(brand)}
      >
        {loadingAvail ? 'Checking availability...' : availError ? 'Retry availability check' : 'Check pricing'}
      </button>
    </div>
  );
}

function GuestDetailsForm({
  listing,
  tenantName,
  checkIn,
  checkOut,
  guests,
  onBook,
  onBack,
  brand,
}: {
  listing: EmbedListingSummary;
  tenantName: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  onBook: (result: BookingResult) => void;
  onBack: () => void;
  brand: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [depositAccepted, setDepositAccepted] = useState(false);
  const [pricing, setPricing] = useState<GuestPriceBreakdown | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const depositRequired = (listing.securityDepositAmount ?? 0) > 0;

  const checkInStr = toCalendarISO(checkIn);
  const checkOutStr = toCalendarISO(checkOut);
  const nights = calculateNights(checkIn, checkOut);

  useEffect(() => {
    let cancelled = false;
    setLoadingPricing(true);
    fetchGuestPriceBreakdown(listing.id, checkInStr, checkOutStr)
      .then((p) => { if (!cancelled) setPricing(p); })
      .catch(() => { if (!cancelled) setError('Could not load pricing. Please try again.'); })
      .finally(() => { if (!cancelled) setLoadingPricing(false); });
    return () => { cancelled = true; };
  }, [listing.id, checkInStr, checkOutStr]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in all guest details.');
      return;
    }
    if (!consentAccepted) {
      setError('Please accept the privacy notice to continue.');
      return;
    }
    if (depositRequired && !depositAccepted) {
      setError('Please accept the refundable security deposit terms to continue.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();

      // Step 1: init-hold
      const holdRes = await fetch(buildApiUrl('/api/Razorpay/order'), {
        method: 'POST',
        headers: getOrderRequestHeaders(idempotencyKey),
        body: JSON.stringify({
          bookingDraft: {
            listingId: listing.id,
            checkinDate: checkInStr,
            checkoutDate: checkOutStr,
            guests,
          },
        }),
      });
      if (!holdRes.ok) {
        const body = await holdRes.json().catch(() => ({}));
        throw new Error(String(body.message ?? body.error ?? 'Failed to create hold'));
      }
      const hold = (await holdRes.json()) as { holdId: number; holdExpiresAt: string; prepToken: string };

      // Step 2: final-charge (Razorpay order)
      const orderRes = await fetch(buildApiUrl('/api/Razorpay/order'), {
        method: 'POST',
        headers: getOrderRequestHeaders(idempotencyKey),
        body: JSON.stringify({
          holdId: hold.holdId,
          holdToken: hold.prepToken,
          currency: 'INR',
          guestInfo: { name: name.trim(), email: email.trim(), phone: phone.trim() },
          guestConsentAccepted: consentAccepted,
          securityDepositAccepted: depositRequired ? depositAccepted : false,
        }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(String(body.message ?? body.error ?? 'Failed to create payment order'));
      }
      // `amount` off this response is RUPEES, while the Razorpay order it created is
      // PAISE — see src/utils/razorpayOrderAmount.ts. Named with its unit so the
      // mismatch is visible at the destructure, and converted once, below.
      const order = (await orderRes.json()) as {
        keyId: string; orderId: string; amount: number; currency: string;
        bookingId: number; bookingToken: string | null;
      };
      const amountPaise = razorpayOrderAmountInrToPaise(Number(order.amount));

      // Step 3: open Razorpay modal
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Payment script failed to load. Please try again.');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: amountPaise,
        currency: order.currency,
        name: tenantName,
        description: `${listing.name} — ${formatNightCount(calculateNights(checkIn, checkOut))}`,
        order_id: order.orderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(buildApiUrl('/api/Razorpay/verify'), {
              method: 'POST',
              headers: getOrderRequestHeaders(crypto.randomUUID()),
              body: JSON.stringify({
                bookingId: order.bookingId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                guestInfo: { name: name.trim(), email: email.trim(), phone: phone.trim() },
              }),
            });
            if (!verifyRes.ok) throw new Error('Payment verification failed');
            onBook({ bookingId: order.bookingId, bookingToken: order.bookingToken });
          } catch {
            setError('Payment succeeded but confirmation failed. Please contact support.');
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => { setSubmitting(false); },
        },
        prefill: { name, email, contact: phone },
        theme: { color: brand },
      });
      rzp.on('payment.failed', (resp) => {
        const r = resp as { error?: { description?: string } };
        setError(r.error?.description ?? 'Payment failed. Please try again.');
        setSubmitting(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="embed-guest-details">
      <button type="button" onClick={onBack} className="mb-3 text-xs text-text-secondary hover:underline">&larr; Back</button>

      <div className="mb-3 rounded-lg bg-bg-muted p-2 text-xs text-text-secondary">
        {listing.name} &middot; {format(checkIn, 'MMM d')} &ndash; {format(checkOut, 'MMM d')} &middot; {formatNightCount(nights)}
      </div>

      {loadingPricing ? (
        <div className="py-4 text-center text-sm text-text-muted">Loading pricing...</div>
      ) : pricing && pricing.finalAmount != null ? (
        <div className="mb-3 rounded-lg border border-border-subtle p-3 text-sm">
          <div className="mb-1 font-medium">Price breakdown</div>
          <div className="flex justify-between text-text-secondary">
            <span>Room fare ({nights} night{nights === 1 ? '' : 's'})</span>
            <span>{formatCurrency(netChargeableRoomFare(pricing))}</span>
          </div>
          {pricing.convenienceFeeAmount > 0 && (
            <div className="flex justify-between text-text-secondary">
              <span>Convenience fee</span>
              <span>{formatCurrency(pricing.convenienceFeeAmount)}</span>
            </div>
          )}
          {pricing.gstAmount != null && pricing.gstAmount > 0 && (
            <div className="flex justify-between text-text-secondary">
              <span>GST ({pricing.gstPercent}%)</span>
              <span>{formatCurrency(pricing.gstAmount)}</span>
            </div>
          )}
          {pricing.touristTaxAmount > 0 && (
            <div className="flex justify-between text-text-secondary">
              <span>Tourist tax</span>
              <span>{formatCurrency(pricing.touristTaxAmount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border-subtle pt-1 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(pricing.finalAmount!)}</span>
          </div>
        </div>
      ) : null}

      <div className="mb-3 grid gap-2">
        <label htmlFor="embed-guest-name" className="text-xs font-medium text-text-secondary">Full name</label>
        <input
          id="embed-guest-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <label htmlFor="embed-guest-email" className="text-xs font-medium text-text-secondary">Email address</label>
        <input
          id="embed-guest-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <label htmlFor="embed-guest-phone" className="text-xs font-medium text-text-secondary">Phone number</label>
        <input
          id="embed-guest-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-border-input bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </div>

      <label className="mb-3 flex items-start gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          data-testid="embed-dpdp-consent"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I consent to {tenantName} collecting and using my name, phone, and email to process this booking
          and send booking-related communications.{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link>.
          <span className="ml-1 text-text-muted">Required · DPDP Act, 2023</span>
        </span>
      </label>

      {depositRequired && (
        <label className="mb-3 flex items-start gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            data-testid="embed-deposit-consent"
            checked={depositAccepted}
            onChange={(e) => setDepositAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I accept the refundable security deposit of {formatCurrency(listing.securityDepositAmount ?? 0)}.
          </span>
        </label>
      )}

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={submitting || !name.trim() || !email.trim() || !phone.trim() || !consentAccepted || (depositRequired && !depositAccepted)}
        onClick={handleSubmit}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={ctaStyle(brand)}
      >
        {submitting ? 'Processing...' : 'Pay & book'}
      </button>
    </div>
  );
}

function ConfirmationView({
  bookingId,
  bookingToken,
  listing,
  checkIn,
  checkOut,
  brand,
}: {
  bookingId: number;
  bookingToken: string | null;
  listing: EmbedListingSummary;
  checkIn: Date;
  checkOut: Date;
  brand: string;
}) {
  const nights = calculateNights(checkIn, checkOut);
  // TASK-10180 defect 1: inside a 600px iframe on a stranger's website there is no other route
  // back to this reservation once the widget unmounts -- the API returns bookingToken precisely
  // so the guest can view/manage the booking later. Same absolute-URL shape as the QR code on
  // BookingConfirmationPage.tsx (`${window.location.origin}/booking/{id}?t={token}`) and the same
  // nullable-token fallback used throughout (GuestDetailsPage.tsx, MyBookingsPage.tsx,
  // ProfilePage.tsx): omit `?t=` when there is no token rather than sending a malformed query string.
  const bookingHref = `${window.location.origin}/booking/${bookingId}${bookingToken ? `?t=${encodeURIComponent(bookingToken)}` : ''}`;
  return (
    <div data-testid="embed-confirmed" className="text-center">
      <div className="mb-3 text-3xl">&#10003;</div>
      <h3 className="mb-1 text-base font-bold">Booking confirmed!</h3>
      <p className="mb-3 text-sm text-text-secondary">
        Your stay at <strong>{listing.name}</strong> is booked.
      </p>
      <div className="mb-3 rounded-lg bg-bg-muted p-3 text-xs text-text-secondary">
        <div>Booking #{bookingId}</div>
        <div>{format(checkIn, 'MMM d')} &ndash; {format(checkOut, 'MMM d')} &middot; {formatNightCount(nights)}</div>
      </div>
      {/* target="_blank" + rel="noopener noreferrer": this widget runs inside a 600px iframe on a
          third-party site. A normal same-tab navigation would drag the entire embed away from the
          confirmation and load the full guest portal inside that cramped frame -- opening a new
          tab is what actually gets the guest back to their reservation. */}
      <a
        href={bookingHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="embed-confirmation-link"
        className="mb-3 inline-block text-sm font-semibold underline"
        style={{ color: brand }}
      >
        View or manage your booking &rarr;
      </a>
      <p className="text-xs text-text-muted">
        A confirmation has been sent to your email. Powered by Atlas.
      </p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function EmbedPage() {
  const { embedKey: routeEmbedKey } = useParams<{ embedKey: string }>();
  const embedKey = routeEmbedKey ?? '';
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Booking state
  const [step, setStep] = useState<Step>('select');
  const [selectedListing, setSelectedListing] = useState<EmbedListingSummary | null>(null);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // Fetch config
  useEffect(() => {
    if (!embedKey) { setError('Missing embed key'); setLoading(false); return; }
    let cancelled = false;
    const base = getApiBaseUrl().replace(/\/$/, '');
    fetch(`${base}/api/public/embed/${encodeURIComponent(embedKey)}/config`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((raw) => { if (!cancelled) setConfig(normalizeConfig(raw as Record<string, unknown>)); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [embedKey]);

  // Auto-select single listing
  useEffect(() => {
    if (config && config.listings.length === 1 && step === 'select') {
      setSelectedListing(config.listings[0]);
      setStep('dates');
    }
  }, [config, step]);

  // Height postMessage
  useEffect(() => {
    if (!embedKey || !config) return;
    const send = () => {
      const h = containerRef.current?.scrollHeight ?? document.body.scrollHeight;
      try { window.parent.postMessage({ type: 'atlas-embed-resize', embedKey, height: h }, '*'); } catch { /* noop */ }
    };
    send();
    const ro = new ResizeObserver(send);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', send);
    const id = window.setInterval(send, 1000);
    return () => { ro.disconnect(); window.removeEventListener('resize', send); window.clearInterval(id); };
  }, [embedKey, config, loading, step, selectedListing, bookingResult]);

  const brand = config?.brandColor?.trim() || '#0f766e';

  if (loading) {
    return (
      <div data-testid="embed-loading" role="status" aria-live="polite" aria-busy="true"
        className="min-h-24 bg-bg-primary p-6 font-sans text-text-primary">
        Loading booking widget…
      </div>
    );
  }

  if (error || !config) {
    return (
      <div data-testid="embed-error" role="alert"
        className="min-h-24 border border-border-subtle bg-bg-surface p-6 font-sans text-support-error">
        Booking widget unavailable. {error ? `(${error.slice(0, 200)})` : ''}
      </div>
    );
  }

  if (!config.isLiveEligible) {
    return (
      <div data-testid="embed-not-eligible"
        className="border border-border-subtle bg-bg-surface p-6 font-sans text-text-primary rounded-xl">
        <h3 className="m-0 font-semibold">Booking not available</h3>
        <p className="mt-2 text-text-secondary">
          This property is not currently taking bookings. Please contact the host directly.
        </p>
        <p data-testid="embed-blocker" style={{ display: 'none' }}>{config.blocker ?? config.websiteState}</p>
      </div>
    );
  }

  if (config.listings.length === 0) {
    return (
      <div data-testid="embed-no-listings"
        className="border border-border-subtle bg-bg-surface p-6 font-sans text-text-primary rounded-xl">
        <h3 className="m-0 font-semibold">No stays available</h3>
        <p className="mt-2 text-text-secondary">Check back soon for available stays.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="embed-widget"
      data-embed-key={embedKey}
      data-tenant-slug={config.tenantSlug}
      className="mx-auto max-w-[480px] bg-bg-primary p-4 font-sans text-text-primary"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        {config.logoUrl && (
          <img src={config.logoUrl} alt={`${config.tenantName} logo`} className="h-10 w-10 rounded-lg object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{config.tenantName}</div>
          {config.tagline && <div className="truncate text-xs text-text-secondary">{config.tagline}</div>}
        </div>
      </div>

      {/* TASK-10178 part 1: always mounted (never conditionally removed) so its TEXT changing
          on every step transition is what triggers the announcement -- a newly-mounted
          role="status" element is less reliably picked up by assistive tech than one whose
          content changes in place. Visually hidden; carries no visible design change. */}
      <div role="status" aria-live="polite" className="sr-only">
        {stepAnnouncementText(step, config.listings.length)}
      </div>

      {/* Steps */}
      {step === 'select' && config.listings.length > 1 && (
        <ListingSelector listings={config.listings} onSelect={(l) => { setSelectedListing(l); setStep('dates'); }} />
      )}

      {step === 'dates' && selectedListing && (
        <DateGuestPicker
          listing={selectedListing}
          brand={brand}
          onConfirm={(ci, co, g) => { setCheckIn(ci); setCheckOut(co); setGuests(g); setStep('details'); }}
        />
      )}

      {step === 'details' && selectedListing && checkIn && checkOut && (
        <GuestDetailsForm
          listing={selectedListing}
          tenantName={config.tenantName}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          brand={brand}
          onBack={() => setStep('dates')}
          onBook={(result) => { setBookingResult(result); setStep('confirmed'); }}
        />
      )}

      {step === 'confirmed' && selectedListing && checkIn && checkOut && bookingResult && (
        <ConfirmationView
          bookingId={bookingResult.bookingId}
          bookingToken={bookingResult.bookingToken}
          listing={selectedListing}
          checkIn={checkIn}
          checkOut={checkOut}
          brand={brand}
        />
      )}

      {/* Footer */}
      <div className="mt-4 text-center text-[10px] text-text-muted">Powered by Atlas</div>
    </div>
  );
}
