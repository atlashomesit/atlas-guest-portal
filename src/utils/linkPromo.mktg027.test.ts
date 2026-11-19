/**
 * MKTG-027: a host's creator tracked link opens the guest site with `?promo=CODE` (often on `/`).
 * The code must be remembered as a link code before the guest picks a listing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROMO_LINK_STORAGE_KEY,
  PROMO_STORAGE_KEY,
  capturePromoFromUrl,
  clearStoredPromo,
  rememberPromoFromLink,
} from './linkPromo';

describe('linkPromo (MKTG-027 creator tracked links)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    clearStoredPromo();
    vi.unstubAllGlobals();
  });

  it('capturePromoFromUrl remembers a creator code from ?promo= on the home page', () => {
    expect(capturePromoFromUrl('?promo=aarav10&utm_source=creator&utm_medium=social')).toBe('AARAV10');
    expect(window.localStorage.getItem(PROMO_STORAGE_KEY)).toBe('AARAV10');
    expect(window.localStorage.getItem(PROMO_LINK_STORAGE_KEY)).toBe('AARAV10');
  });

  it('rememberPromoFromLink reads the live URL search string', () => {
    window.history.replaceState(window.history.state, '', '/?promo=WANDERGOA');
    expect(rememberPromoFromLink()).toBe(true);
    expect(window.localStorage.getItem(PROMO_LINK_STORAGE_KEY)).toBe('WANDERGOA');
    window.history.replaceState(window.history.state, '', '/');
  });

  it('returns null for an empty or missing promo param', () => {
    expect(capturePromoFromUrl('?utm_source=creator')).toBeNull();
    expect(capturePromoFromUrl('?promo=')).toBeNull();
    expect(window.localStorage.getItem(PROMO_STORAGE_KEY)).toBeNull();
  });
});