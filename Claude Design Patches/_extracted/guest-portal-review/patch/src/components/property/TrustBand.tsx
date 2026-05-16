import React, { useMemo } from 'react';
import {
  ReceiptText,
  CalendarClock,
  ShieldCheck,
  MessageCircle,
  Phone,
  BadgeCheck,
} from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { getLegalIdentifiers } from '@/config/legalIdentifiers';
import { ILLUSTRATIVE_OTA_GUEST_FEE_PERCENT } from '@/utils/directBookingPromo';
import {
  cancellationTimeline,
  freeCancelByDate,
  fmtFullDay,
  type CancellationTier,
  type RefundStep,
} from './cancellationTimeline';

/**
 * Trust band — Direction C of the May 2026 property-page rebuild.
 *
 * A 4-row editorial section that sits between the gallery and the booking
 * card on the property detail page. Surfaces the four anxieties an Indian
 * first-time guest hits before they pay:
 *   01 Legitimacy   — who you're paying (legal name, GSTIN, CIN, NITI Aayog)
 *   02 Cancellation — refund timeline anchored to the guest's check-in date
 *   03 Payment      — Razorpay, UPI/cards/netbanking, no surprise charges
 *   04 Support      — WhatsApp + call, reply-time promise
 *
 * Data sources today:
 *   - Legal IDs: getLegalIdentifiers() from src/config/legalIdentifiers.ts
 *     (hardcoded Atlas defaults; per-tenant + listing-level fields are a
 *     separate backend PR — until then non-Atlas tenants hide the legal
 *     row to avoid mis-attribution).
 *   - Cancellation tier: passed in from the listing record (Property.cancellationTier).
 *   - Check-in date: BookingContext (when the guest has picked dates, the
 *     timeline anchors to those; when not, generic tier copy renders).
 *   - Host phone: hostPhone from listing detail.
 *
 * Visual rules (warm-editorial guardrails):
 *   - Solid surfaces; no backdrop-filter / glassmorphism.
 *   - --accent-soft / --cta-primary for highlights, --support-success for "full refund".
 *   - Cards: 16px+ radius, hairline border-subtle, level-1 resting shadow.
 *   - No emoji, no decorative SVG illustration.
 */
export interface TrustBandProps {
  cancellationTier?: CancellationTier | null;
  hostPhoneE164?: string | null;          // e.g. "917032493290"
  hostPhoneDisplay?: string | null;       // e.g. "+91 70324 93290"
  hostReplyMinutes?: number | null;
  listingName?: string;
  /** Tenant photo-verification timestamp (ISO). Drives the "Atlas-verified photos" pill. */
  photosVerifiedAt?: string | null;
  className?: string;
}

const TrustBand: React.FC<TrustBandProps> = ({
  cancellationTier,
  hostPhoneE164,
  hostPhoneDisplay,
  hostReplyMinutes,
  listingName,
  photosVerifiedAt,
  className,
}) => {
  const { booking } = useBooking();
  const tier: CancellationTier = cancellationTier ?? 'Flexible';

  const checkIn = useMemo<Date | null>(() => {
    if (!booking.checkIn) return null;
    const d = new Date(booking.checkIn);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [booking.checkIn]);

  const timeline = useMemo(() => cancellationTimeline(tier, checkIn), [tier, checkIn]);
  const freeBy = useMemo(() => freeCancelByDate(tier, checkIn), [tier, checkIn]);

  const legal = useMemo(() => getLegalIdentifiers(), []);

  const otaPct = Math.round(ILLUSTRATIVE_OTA_GUEST_FEE_PERCENT * 100);

  const photosVerifiedOn = useMemo(() => {
    if (!photosVerifiedAt) return null;
    const d = new Date(photosVerifiedAt);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d);
  }, [photosVerifiedAt]);

  return (
    <section
      id="trust-band"
      className={`pb-8 border-b border-border-subtle ${className ?? ''}`}
      data-testid="trust-band"
      aria-labelledby="trust-band-heading"
    >
      <p className="text-xs font-bold tracking-[0.16em] uppercase text-[color:var(--cta-primary)] mb-2">
        Before you book
      </p>
      <h2
        id="trust-band-heading"
        className="text-2xl sm:text-3xl font-semibold text-text-primary leading-tight tracking-tight mb-3"
        style={{ fontFamily: 'var(--font-family-display, "Cormorant Garamond", serif)' }}
      >
        Verified · transparent · reachable
      </h2>
      <p className="text-text-muted text-base sm:text-[17px] leading-relaxed max-w-prose mb-6">
        The four things you would want to know about a homestay you have not visited — answered
        here, before the booking card.
      </p>

      <div className="flex flex-col gap-3">
        {/* ── 01 · Legitimacy ───────────────────────────────────────── */}
        {legal && (
          <TrustRow num="01" label="Legitimacy" title="Who you're booking with" icon={ReceiptText}>
            <p className="m-0 text-text-primary leading-relaxed">
              <strong className="font-semibold">{legal.legalName}</strong>
              {' '}— registered in India. This home is operated directly; there is no online travel
              agency between you and the host.
            </p>
            {(legal.gstin || legal.cin || legal.nitiAayog || legal.fssai) && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {legal.gstin && <LegalCell label="GSTIN" value={legal.gstin} />}
                {legal.cin && <LegalCell label="CIN" value={legal.cin} />}
                {legal.nitiAayog && <LegalCell label="NITI Aayog" value={legal.nitiAayog} />}
                {legal.fssai && <LegalCell label="FSSAI" value={legal.fssai} />}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {photosVerifiedOn && (
                <SoftPill tone="success">
                  <BadgeCheck size={13} aria-hidden /> Atlas-verified photos · {photosVerifiedOn}
                </SoftPill>
              )}
              <SoftPill tone="accent">Direct booking · 0% commission to OTAs</SoftPill>
            </div>
          </TrustRow>
        )}

        {/* ── 02 · Cancellation ──────────────────────────────────────── */}
        <TrustRow num="02" label="Cancellation" title="If your plans change" icon={CalendarClock}>
          <p className="m-0 text-text-primary leading-relaxed">
            This home is on the <strong className="font-semibold">{tier}</strong> cancellation tier.
            Refunds run through Razorpay and reach your original payment method in 5–7 business days.
          </p>
          <RefundTimeline steps={timeline} />
          <p className="m-0 mt-3 text-sm text-text-muted">
            {freeBy ? (
              <>Free cancellation until <strong className="text-text-primary font-semibold">{fmtFullDay(freeBy)}</strong> for your selected dates.</>
            ) : (
              <>Pick your dates to see the exact free-cancellation deadline.</>
            )}
          </p>
        </TrustRow>

        {/* ── 03 · Payment ───────────────────────────────────────────── */}
        <TrustRow num="03" label="Payment" title="How payment works" icon={ShieldCheck}>
          <p className="m-0 text-text-primary leading-relaxed">
            You pay {legal?.legalName ?? 'us'} through <strong className="font-semibold">Razorpay</strong>{' '}
            — the same payment processor most Indian businesses use. We charge only the total shown
            on the booking card. No service fee at the property, no convenience charge at check-in,
            no upsell calls.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['UPI', 'GPay', 'PhonePe', 'Paytm', 'Visa', 'Mastercard', 'RuPay', 'Netbanking'].map((label) => (
              <PayLogo key={label} label={label} />
            ))}
          </div>
          <p className="m-0 mt-3 text-sm text-text-muted leading-relaxed">
            Booking the same home through an OTA would add roughly{' '}
            <strong className="text-text-primary font-semibold">{otaPct}%</strong>{' '}
            in guest service fees on top of the price below. Direct booking does not.
          </p>
        </TrustRow>

        {/* ── 04 · Support ───────────────────────────────────────────── */}
        <TrustRow num="04" label="Support" title="Talk to a human" icon={MessageCircle}>
          <p className="m-0 text-text-primary leading-relaxed">
            WhatsApp{' '}
            {hostPhoneDisplay ? (
              <strong className="font-semibold">{hostPhoneDisplay}</strong>
            ) : (
              <strong className="font-semibold">the in-house team</strong>
            )}
            {typeof hostReplyMinutes === 'number' && (
              <> — average reply <strong className="font-semibold">{hostReplyMinutes} minutes</strong>,</>
            )}{' '}
            7am to 11pm IST. Calls outside those hours go to voicemail and are returned the next morning.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {hostPhoneE164 && (
              <a
                href={`https://wa.me/${hostPhoneE164}?text=Hi%2C%20I%27m%20interested%20in%20booking%20${encodeURIComponent(listingName ?? 'this home')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-muted hover:border-[color:var(--cta-primary)] transition-colors min-h-[44px]"
                data-testid="trust-band-whatsapp"
              >
                <MessageCircle size={15} aria-hidden /> WhatsApp the host
              </a>
            )}
            {hostPhoneE164 && (
              <a
                href={`tel:+${hostPhoneE164}`}
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-muted hover:border-[color:var(--cta-primary)] transition-colors min-h-[44px]"
                data-testid="trust-band-call"
              >
                <Phone size={15} aria-hidden /> Call before you book
              </a>
            )}
          </div>
        </TrustRow>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────── helpers
type IconType = React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

interface TrustRowProps {
  num: string;
  label: string;
  title: string;
  icon: IconType;
  children: React.ReactNode;
}
const TrustRow: React.FC<TrustRowProps> = ({ num, label, title, icon: Icon, children }) => (
  <article className="grid gap-4 sm:gap-7 sm:grid-cols-[210px_1fr] bg-bg-surface border border-border-subtle rounded-2xl shadow-level1 p-5 sm:p-6">
    <div className="flex sm:block items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[color:var(--cta-primary)] sm:hidden">
        <Icon size={16} aria-hidden />
      </div>
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-text-muted mb-1">
          {num} · {label}
        </p>
        <h3
          className="text-xl sm:text-[22px] font-semibold text-text-primary leading-snug tracking-tight m-0"
          style={{ fontFamily: 'var(--font-family-display, "Cormorant Garamond", serif)' }}
        >
          {title}
        </h3>
      </div>
    </div>
    <div className="text-[15px] leading-relaxed text-text-primary">{children}</div>
  </article>
);

const LegalCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border-subtle bg-bg-primary px-3 py-2.5">
    <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-text-muted m-0">{label}</p>
    <p className="text-sm font-semibold text-text-primary tabular-nums m-0 mt-1 break-words">{value}</p>
  </div>
);

const PayLogo: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-border-strong bg-bg-surface text-[11px] font-semibold text-text-primary tracking-wide">
    {label}
  </span>
);

const SoftPill: React.FC<{ tone: 'success' | 'accent'; children: React.ReactNode }> = ({ tone, children }) => {
  const bg = tone === 'success'
    ? 'color-mix(in srgb, var(--support-success) 12%, white)'
    : 'var(--accent-soft)';
  const color = tone === 'success'
    ? 'var(--support-success)'
    : 'var(--cta-primary)';
  const border = tone === 'success'
    ? 'color-mix(in srgb, var(--support-success) 28%, white)'
    : 'color-mix(in srgb, var(--cta-primary) 22%, white)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {children}
    </span>
  );
};

// ─────────────────────────────────────────────── refund timeline
const RefundTimeline: React.FC<{ steps: RefundStep[] }> = ({ steps }) => (
  <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 rounded-xl border border-border-subtle overflow-hidden">
    {steps.map((step, i) => (
      <div
        key={i}
        className="p-3.5 border-b sm:border-b-0 sm:border-r border-border-subtle last:border-b-0 sm:last:border-r-0"
        style={{ background: refundStepBg(step.tone) }}
      >
        <p
          className="text-[10px] font-bold tracking-[0.10em] uppercase m-0 mb-1"
          style={{ color: refundStepAccent(step.tone) }}
        >
          {step.range}
        </p>
        <p className="text-sm font-semibold text-text-primary m-0">{step.label}</p>
        <p className="text-xs text-text-muted leading-snug m-0 mt-1">{step.detail}</p>
      </div>
    ))}
  </div>
);

function refundStepBg(tone: RefundStep['tone']): string {
  switch (tone) {
    case 'good':    return 'color-mix(in srgb, var(--support-success) 10%, white)';
    case 'current': return 'var(--accent-soft)';
    case 'mid':
    case 'late':
    default:        return 'var(--bg-surface)';
  }
}
function refundStepAccent(tone: RefundStep['tone']): string {
  switch (tone) {
    case 'good':    return 'var(--support-success)';
    case 'current': return 'var(--cta-primary)';
    case 'mid':     return 'var(--text-muted)';
    case 'late':
    default:        return 'var(--text-muted)';
  }
}

export default TrustBand;
