import { normalizePromoCodeSubmit } from './promoCodeInput';

/**
 * AGT-003 / MKTG-027: a promo code that arrived on a checkout LINK (`?promo=`, e.g. from the AI sales agent or a
 * host's creator tracked link) is remembered under its own key so checkout can tell it from a code the guest typed
 * or copied by hand. Only a link code is applied automatically; a hand-typed code keeps the Apply button.
 */
export const PROMO_STORAGE_KEY = 'atlas_guest_promo_code';
export const PROMO_LINK_STORAGE_KEY = 'atlas_guest_promo_from_link';

export function rememberLinkPromo(code: string): void {
  try {
    window.localStorage.setItem(PROMO_STORAGE_KEY, code);
    window.localStorage.setItem(PROMO_LINK_STORAGE_KEY, code);
  } catch { /* ignore */ }
}

export function readLinkPromo(): string {
  try {
    return (window.localStorage.getItem(PROMO_LINK_STORAGE_KEY) || '').slice(0, 32);
  } catch { return ''; }
}

/** A discount must never follow a guest to another home or into their next booking. */
export function clearStoredPromo(): void {
  try {
    window.localStorage.removeItem(PROMO_STORAGE_KEY);
    window.localStorage.removeItem(PROMO_LINK_STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Reads `?promo=` from a query string and, when present, remembers it as a link code (not hand-typed). */
export function capturePromoFromUrl(search?: string): string | null {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return null;
  const promo = normalizePromoCodeSubmit(new URLSearchParams(query).get('promo') || '');
  if (!promo) return null;
  rememberLinkPromo(promo);
  return promo;
}

/**
 * Boot-time step: a creator tracked link (or any `?promo=` URL) often lands on the host home page, not a listing.
 * Remember the code before routing so it survives the hop to checkout. Returns true when a code was captured.
 */
export function rememberPromoFromLink(): boolean {
  return capturePromoFromUrl() != null;
}
