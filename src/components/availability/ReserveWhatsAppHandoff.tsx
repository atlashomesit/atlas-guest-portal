/**
 * Reserve-step hand-off for a tenant that cannot take an online payment.
 *
 * Why this exists: since TASK-101182 the Reserve step's init-hold call (POST /api/Razorpay/order,
 * bookingDraft only) fails closed with 422 PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT for a tenant with no
 * usable payment provider - exactly the tenants GET /tenants/from-domain reports as bookingMode "WHATSAPP"
 * (`TenantInfo.bookingMode`: "hand off to host's WhatsApp with prefilled booking details"). The old
 * hand-off lived only on GuestDetailsPage (after a hold), which that guard made unreachable for them, and
 * the widget answered the 422 with the generic "We couldn't start checkout" line.
 *
 * Presentational only: the host number comes from the resolved tenant context (never invented or defaulted
 * - with no number it renders the message and NO link), and the link is pre-filled with the dates and
 * guest count the guest already chose so nothing is retyped in WhatsApp. Copy + link builder:
 * reserveHandoffLink.ts.
 */
import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { RESERVE_HANDOFF_COPY } from './reserveHandoffLink';

export interface ReserveWhatsAppHandoffProps {
  /** From buildReserveWhatsAppUrl; '' = the host has no WhatsApp number, so show the message only. */
  href: string;
  onCtaClick?: () => void;
}

export const ReserveWhatsAppHandoff: React.FC<ReserveWhatsAppHandoffProps> = ({ href, onCtaClick }) => (
  <div
    role="alert"
    data-testid="reserve-whatsapp-handoff"
    className="rounded-xl border border-border-subtle bg-bg-surface p-3"
    style={{ marginTop: 8 }}
  >
    <p className="text-sm font-semibold text-text-primary" style={{ margin: 0 }}>
      {RESERVE_HANDOFF_COPY.title}
    </p>
    <p className="text-sm text-text-secondary" style={{ margin: '4px 0 0' }}>
      {href ? RESERVE_HANDOFF_COPY.withHostNumber : RESERVE_HANDOFF_COPY.withoutHostNumber}
    </p>
    {href ? (
      <>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
          data-testid="reserve-whatsapp-handoff-cta"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            marginTop: 10,
            borderRadius: 12,
            padding: '10px 16px',
            background: '#075e54',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <FaWhatsapp aria-hidden="true" />
          {RESERVE_HANDOFF_COPY.cta}
        </a>
        <p className="text-xs text-text-secondary" style={{ margin: '6px 0 0', textAlign: 'center' }}>
          {RESERVE_HANDOFF_COPY.reassurance}
        </p>
      </>
    ) : null}
  </div>
);

export default ReserveWhatsAppHandoff;
