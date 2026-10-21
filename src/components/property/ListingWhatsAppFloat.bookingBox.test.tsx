// GUEST-035: floaters must not cover the booking box (Total row) on phones.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ListingWhatsAppFloat from './ListingWhatsAppFloat';

let ioCallback: IntersectionObserverCallback | null = null;
const observed: Element[] = [];

function setup(phone: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: phone && q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  class IO {
    constructor(cb: IntersectionObserverCallback) { ioCallback = cb; }
    observe(el: Element) { observed.push(el); }
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  const form = document.createElement('form');
  form.setAttribute('data-testid', 'guest-booking-form');
  document.body.appendChild(form);
  render(<ListingWhatsAppFloat listingName="Studio 301" phoneDigits="919876543210" brandName="Atlas" listingId={1} />);
  return form;
}

describe('ListingWhatsAppFloat vs booking box (GUEST-035)', () => {
  beforeEach(() => { observed.length = 0; ioCallback = null; });
  afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

  it('hides while the booking box is on screen on a phone', () => {
    const form = setup(true);
    expect(screen.getByTestId('listing-whatsapp-float')).toBeTruthy();
    expect(observed).toContain(form);
    act(() => { ioCallback!([{ target: form, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
    expect(screen.queryByTestId('listing-whatsapp-float')).toBeNull();
    act(() => { ioCallback!([{ target: form, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver); });
    expect(screen.getByTestId('listing-whatsapp-float')).toBeTruthy();
  });

  it('does not watch the booking box on desktop (sidebar does not collide)', () => {
    const form = setup(false);
    expect(observed).not.toContain(form);
    expect(screen.getByTestId('listing-whatsapp-float')).toBeTruthy();
  });
});
