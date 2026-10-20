import { describe, expect, it } from 'vitest';
import { buildHostFailureContact, buildHostPaymentFailureMessage } from './hostPaymentFailure';

const ctx = {
  roomName: 'Penthouse',
  checkInLabel: 'Tue, 20 Oct 2026',
  checkOutLabel: 'Wed, 21 Oct 2026',
  nights: 1,
  guests: 2,
  amountInr: 4478.96,
  guestName: 'Asha Rao',
};

describe('host payment-failure contact (founder ruling 2026-10-19)', () => {
  it('pre-writes the message with the room, dates, guests, amount and guest name', () => {
    const msg = buildHostPaymentFailureMessage(ctx);
    expect(msg).toContain('Asha Rao');
    expect(msg).toContain('Penthouse');
    expect(msg).toContain('Tue, 20 Oct 2026 to Wed, 21 Oct 2026');
    expect(msg).toContain('1 night');
    expect(msg).toContain('2 guests');
    expect(msg).toContain('₹4,479');
    expect(msg).toContain("my payment didn't go through");
  });

  it('WhatsApp is a wa.me link to the HOST number (a bare 10-digit number gets 91)', () => {
    const c = buildHostFailureContact({ ...ctx, hostWhatsAppDigits: '9123456789' });
    expect(c?.kind).toBe('whatsapp');
    expect(c?.label).toBe('Message the host on WhatsApp');
    const url = new URL(c!.href);
    expect(url.origin + url.pathname).toBe('https://wa.me/919123456789');
    expect(url.searchParams.get('text')).toContain('Asha Rao');
  });

  it('with no WhatsApp number it is a call link to the host phone', () => {
    const c = buildHostFailureContact({ ...ctx, hostWhatsAppDigits: null, hostPhoneDigits: '9123456780' });
    expect(c).toEqual({ kind: 'call', href: 'tel:+919123456780', label: 'Call the host' });
  });

  it('with no host number at all there is NO contact button - never a fallback to anyone else\'s number', () => {
    expect(buildHostFailureContact({ ...ctx, hostWhatsAppDigits: null, hostPhoneDigits: null })).toBeNull();
    expect(buildHostFailureContact({ ...ctx, hostWhatsAppDigits: '', hostPhoneDigits: '  ' })).toBeNull();
  });

  it('degrades gracefully when details are missing (no dates, no amount, no name)', () => {
    const msg = buildHostPaymentFailureMessage({ roomName: null });
    expect(msg.startsWith('Hi,')).toBe(true);
    expect(msg).toContain('your property');
    expect(msg).not.toContain('₹');
  });
});
