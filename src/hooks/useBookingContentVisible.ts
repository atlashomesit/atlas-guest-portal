import { useEffect, useState } from 'react';

/** Always-guarded content: host checkout instructions + message composer (all widths). */
export const ALWAYS_SELECTOR = '[data-testid="guest-message-composer"], [data-testid="checkout-briefing"]';
/** GUEST-035: the booking box (Total row, savings/cancellation lines) — guarded on phones only. */
export const PHONE_ONLY_SELECTOR = '[data-testid="guest-booking-form"], [data-booking-widget="true"], .lv-booking';
export const PHONE_MEDIA_QUERY = '(max-width: 767px)';

function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(PHONE_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 767;
}

/**
 * True while content a floating button must never cover is on screen. Floaters (support pill,
 * FAQ, host WhatsApp) hide while it is true. Loads async and can remount, hence MutationObserver.
 */
export function useBookingContentVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    let byElement = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        byElement.set(entry.target, entry.isIntersecting);
      }
      setVisible([...byElement.values()].some(Boolean));
    }, { rootMargin: '0px 0px 96px 0px' });
    const sync = () => {
      const selector = isPhone() ? `${ALWAYS_SELECTOR}, ${PHONE_ONLY_SELECTOR}` : ALWAYS_SELECTOR;
      const next = [...document.querySelectorAll(selector)];
      if (next.length === byElement.size && next.every((el) => byElement.has(el))) return;
      io.disconnect();
      byElement = new Map(next.map((el) => [el, byElement.get(el) ?? false]));
      setVisible([...byElement.values()].some(Boolean));
      next.forEach((el) => io.observe(el));
    };
    const changes = new MutationObserver(sync);
    changes.observe(document.body, { childList: true, subtree: true });
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_MEDIA_QUERY) : null;
    mq?.addEventListener?.('change', sync);
    sync();
    return () => { changes.disconnect(); io.disconnect(); mq?.removeEventListener?.('change', sync); };
  }, []);
  return visible;
}
