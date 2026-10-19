/**
 * Founder ruling 2026-10-19: after a failed payment the guest sees "Payment didn't go through" with [Try again] and
 * [Message the host on WhatsApp]. The WhatsApp button is a wa.me link to the HOST's own number, pre-written with the
 * room, dates, guests, amount and guest name; the guest only taps Send. With no WhatsApp number the fallback is a
 * call link to the host's phone. NEVER Atlas's own number: a host with no number gets no contact button at all.
 */
import { buildWaLink } from '@/utils/whatsapp';

export interface HostFailureContext {
  /** Host WhatsApp number, digits only (from the listing owner's checkout-info). */
  hostWhatsAppDigits?: string | null;
  /** Host phone, digits only. */
  hostPhoneDigits?: string | null;
  roomName?: string | null;
  /** Already formatted for guests, e.g. "Tue, 20 Oct 2026". */
  checkInLabel?: string | null;
  checkOutLabel?: string | null;
  nights?: number | null;
  guests?: number | null;
  /** Amount in rupees the guest was trying to pay. */
  amountInr?: number | null;
  guestName?: string | null;
}

export interface HostFailureContactAction {
  kind: 'whatsapp' | 'call';
  href: string;
  label: string;
}

const digitsOnly = (v?: string | null): string => (v ?? '').replace(/\D/g, '');

const rupees = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** The message the guest sends the host; every field the founder named is present when known. */
export function buildHostPaymentFailureMessage(ctx: HostFailureContext): string {
  const who = (ctx.guestName ?? '').trim();
  const room = (ctx.roomName ?? '').trim() || 'your property';
  const parts: string[] = [];
  parts.push(who ? `Hi, this is ${who}.` : 'Hi,');
  let line = `I tried to book ${room}`;
  if (ctx.checkInLabel && ctx.checkOutLabel) {
    line += ` for ${ctx.checkInLabel} to ${ctx.checkOutLabel}`;
    const n = ctx.nights && ctx.nights > 0 ? ctx.nights : null;
    const g = ctx.guests && ctx.guests > 0 ? ctx.guests : null;
    const bits: string[] = [];
    if (n) bits.push(`${n} ${n === 1 ? 'night' : 'nights'}`);
    if (g) bits.push(`${g} ${g === 1 ? 'guest' : 'guests'}`);
    if (bits.length) line += ` (${bits.join(', ')})`;
  }
  if (ctx.amountInr && ctx.amountInr > 0) line += `, total ${rupees(ctx.amountInr)}`;
  line += ", but my payment didn't go through. Can you help me complete the booking?";
  parts.push(line);
  return parts.join(' ');
}

/**
 * The host-contact button for the failed-payment panel, or null when the host has no number.
 * WhatsApp first; a call link only when there is no WhatsApp number.
 */
export function buildHostFailureContact(ctx: HostFailureContext): HostFailureContactAction | null {
  const wa = digitsOnly(ctx.hostWhatsAppDigits);
  if (wa) {
    return {
      kind: 'whatsapp',
      href: buildWaLink({ phoneE164: wa, text: buildHostPaymentFailureMessage(ctx) }),
      label: 'Message the host on WhatsApp',
    };
  }
  const phone = digitsOnly(ctx.hostPhoneDigits);
  if (phone) {
    // Bare 10-digit Indian national numbers get +91, anything longer is already international.
    const e164 = phone.length === 10 ? `91${phone}` : phone;
    return { kind: 'call', href: `tel:+${e164}`, label: 'Call the host' };
  }
  return null;
}
