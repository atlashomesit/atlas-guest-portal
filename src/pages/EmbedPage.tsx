import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { getApiBaseUrl } from '@/runtime-config';
import { buildApiUrl, getApiHeaders, getOrderRequestHeaders } from '@/api/client';
import { fetchGuestPriceBreakdown, netChargeableRoomFare, type GuestPriceBreakdown } from '@/api/pricingClient';
import { getIstCalendarDate, toCalendarISO } from '@/utils/date';
import { calculateNights, formatNightCount } from '@/utils/dateHelpers';
import { formatCurrency } from '@/utils/formatting';

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

type Step = 'select' | 'dates' | 'details' | 'paying' | 'confirmed';

type BookingResult = {
  bookingId: number;
  bookingToken: string | null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function readableCtaText(background: string): string {
  const match = background.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return 'var(--text-on-cta, #ffffff)';
  const hex = match[1].length === 3 ? match[1].split('').map((channel) => `${channel}${channel}`).join('') : match[1];
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? '#111827' : '#ffffff';
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
      baseNightlyRate: r.baseNightlyRate != null ? Number(r.baseNightlyRate ?? r.BaseNightlyRate) : null,
      coverPhotoUrl: (r.coverPhotoUrl ?? r.CoverPhotoUrl) as string | null,
      checkInTime: (r.checkInTime ?? r.CheckInTime) as string | null,
      checkOutTime: (r.checkOutTime ?? r.CheckOutTime) as string | null,
      timezoneId: (r.timezoneId ?? r.TimezoneId) as string | null,
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
  const days = (await res.json()) as Record<string, unknown>[];
  const map = new Map<string, string>();
  for (const d of days) {
    const date = String(d.date ?? d.Date ?? '').slice(0, 10);
    const status = String(d.status ?? d.Status ?? 'available');
    if (date) map.set(date, status);
  }
  return map;
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
      {listings.length === 1 ? (
        <div className="mb-3 flex items-center gap-3">
          {listings[0].coverPhotoUrl && (
            <img src={listings[0].coverPhotoUrl} alt={listings[0].name} className="h-14 w-14 rounded-lg object-cover" />
          )}
          <div>
            <div className="text-sm font-semibold">{listings[0].name}</div>
            {listings[0].propertyName && <div className="text-xs text-text-secondary">{listings[0].propertyName}</div>}
            {listings[0].baseNightlyRate != null && (
              <div className="mt-0.5 text-xs text-text-muted">{formatCurrency(listings[0].baseNightlyRate)}/night</div>
            )}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}

function DateGuestPicker({
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
  const [guests, setGuests] = useState(2);
  const [loadingAvail, setLoadingAvail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingAvail(true);
    // Pre-warm availability check in background (non-blocking)
    const from = format(today, 'yyyy-MM-dd');
    const to = format(addDays(today, 90), 'yyyy-MM-dd');
    fetchAvailability(listing.id, from, to).then(() => {
      if (!cancelled) setLoadingAvail(false);
    });
    return () => { cancelled = true; };
  }, [listing.id, today]);

  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;
  const canSubmit = checkIn && checkOut && nights > 0 && guests >= 1;

  return (
    <div data-testid="embed-date-guest">
      <label className="mb-1 block text-xs font-medium text-text-secondary">Check-in</label>
      <input
        type="date"
        value={checkIn ? format(checkIn, 'yyyy-MM-dd') : ''}
        min={format(today, 'yyyy-MM-dd')}
        max={format(maxDate, 'yyyy-MM-dd')}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
          setCheckIn(d);
          if (d && checkOut && d >= checkOut) setCheckOut(null);
        }}
        className="mb-2 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
      />

      <label className="mb-1 block text-xs font-medium text-text-secondary">Check-out</label>
      <input
        type="date"
        value={checkOut ? format(checkOut, 'yyyy-MM-dd') : ''}
        min={checkIn ? format(addDays(checkIn, 1), 'yyyy-MM-dd') : format(addDays(today, 1), 'yyyy-MM-dd')}
        max={format(maxDate, 'yyyy-MM-dd')}
        onChange={(e) => {
          setCheckOut(e.target.value ? new Date(e.target.value + 'T00:00:00') : null);
        }}
        className="mb-2 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
      />

      {checkIn && checkOut && (
        <div className="mb-2 text-xs text-text-muted">{formatNightCount(nights)}</div>
      )}

      <label className="mb-1 block text-xs font-medium text-text-secondary">Guests</label>
      <select
        value={guests}
        onChange={(e) => setGuests(parseInt(e.target.value, 10) || 2)} // eslint-disable-line atlas/no-coerce-numeric-onchange -- select element, cannot be cleared
        className="mb-3 w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
      >
        {Array.from({ length: Math.min(listing.maxGuests, 16) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n} guest{n === 1 ? '' : 's'}</option>
        ))}
      </select>

      <button
        type="button"
        disabled={!canSubmit || loadingAvail}
        onClick={() => canSubmit && onConfirm(checkIn, checkOut, guests)}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: brand, color: readableCtaText(brand) }}
      >
        {loadingAvail ? 'Checking availability...' : 'Check pricing'}
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
  const [pricing, setPricing] = useState<GuestPriceBreakdown | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
          guestConsentAccepted: true,
        }),
      });
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(String(body.message ?? body.error ?? 'Failed to create payment order'));
      }
      const order = (await orderRes.json()) as {
        keyId: string; orderId: string; amount: number; currency: string;
        bookingId: number; bookingToken: string | null;
      };

      // Step 3: open Razorpay modal
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Payment script failed to load. Please try again.');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
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
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
        <input
          type="tel"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={submitting || !name.trim() || !email.trim() || !phone.trim()}
        onClick={handleSubmit}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: brand, color: readableCtaText(brand) }}
      >
        {submitting ? 'Processing...' : 'Pay & book'}
      </button>
    </div>
  );
}

function ConfirmationView({
  bookingId,
  listing,
  checkIn,
  checkOut,
}: {
  bookingId: number;
  bookingToken: string | null;
  listing: EmbedListingSummary;
  checkIn: Date;
  checkOut: Date;
  brand: string;
}) {
  const nights = calculateNights(checkIn, checkOut);
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
