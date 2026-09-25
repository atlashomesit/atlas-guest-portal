import { describe, it, expect } from 'vitest';
import { buildListingWhatsAppUrl } from './ListingWhatsAppFloat';

/**
 * TASK-102397 — "Chat with Host" pre-fill must survive ampersands (and +, #) in
 * property names. Board defect shape: `encodeURI` leaves `&` unescaped, splitting the
 * `?text=` query param and opening a blank chat.
 *
 * Source verification 2026-09-23: every wa.me pre-fill in this repo already uses
 * `encodeURIComponent` (no bare `encodeURI` for message text exists). These tests pin
 * the board's exact case ("Bed & Breakfast") so it cannot regress.
 */
describe('buildListingWhatsAppUrl — TASK-102397 ampersand encoding', () => {
  it('encodes an ampersand in the property name so the text param stays intact', () => {
    const url = buildListingWhatsAppUrl('9812345678', 'Bed & Breakfast', 'Royal Palms');
    expect(url.startsWith('https://wa.me/919812345678?text=')).toBe(true);
    const textParam = decodeURIComponent(url.split('?text=')[1]);
    expect(textParam).toBe('Hi, I have a question about Bed & Breakfast on Royal Palms');
    // The raw URL must not contain a bare & inside the encoded text value.
    expect(url.split('?text=')[1]).not.toContain('&');
  });

  it('encodes +, # and ? in names without breaking the link', () => {
    const url = buildListingWhatsAppUrl('9812345678', 'Villa A+ #1?', 'Brand');
    const textParam = decodeURIComponent(url.split('?text=')[1]);
    expect(textParam).toContain('Villa A+ #1?');
  });

  it('returns "" with no host number (never a recipient-less wa.me link)', () => {
    expect(buildListingWhatsAppUrl('', 'Bed & Breakfast', 'Brand')).toBe('');
  });
});
