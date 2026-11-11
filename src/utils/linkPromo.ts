/**
 * AGT-003: a promo code that arrived on a checkout LINK (`?promo=`, e.g. from the AI sales agent) is remembered
 * under its own key so checkout can tell it from a code the guest typed or copied by hand. Only a link code is
 * applied automatically; a hand-typed code keeps the Apply button.
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
