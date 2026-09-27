import { describe, expect, it } from 'vitest';
import { buildWaLink, defaultPrefill } from './whatsapp';

/**
 * TASK-102397 — 'Chat with Host' pre-fill must survive &, +, # in property
 * names. Board defect shape: `encodeURI` leaves `&` unescaped, splitting the
 * `?text=` param and opening a blank chat. The shared builder uses
 * `encodeURIComponent`; these tests pin the board's exact case plus the
 * 10-digit national-number 91-prefixing contract (TASK-4300).
 */
describe('buildWaLink — TASK-102397 pre-fill encoding', () => {
  it('encodes Bed & Breakfast so the text param stays intact', () => {
    const url = buildWaLink({
      phoneE164: '9812345678',
      text: 'Hi, I have a question about Bed & Breakfast',
    });
    expect(url.startsWith('https://wa.me/919812345678?text=')).toBe(true);
    expect(url.split('?text=')[1]).not.toContain('&');
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('Bed & Breakfast');
  });

  it('encodes +, # and ? without breaking the link', () => {
    const url = buildWaLink({ phoneE164: '919812345678', text: 'Villa A+ #1?' });
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Villa A+ #1?');
  });

  it('omits ?text when there is no message', () => {
    expect(buildWaLink({ phoneE164: '9812345678', text: '' })).toBe(
      'https://wa.me/919812345678',
    );
  });

  it('leaves already-prefixed numbers untouched', () => {
    expect(buildWaLink({ phoneE164: '919812345678', text: 'hi' })).toBe(
      `https://wa.me/919812345678?text=${encodeURIComponent('hi')}`,
    );
  });

  it('defaultPrefill never returns a blank message', () => {
    expect(defaultPrefill({}).length).toBeGreaterThan(0);
  });
});
