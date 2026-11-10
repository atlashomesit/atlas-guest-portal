import { useEffect } from 'react';
import { STICKY_BAR_OFFSET_VAR } from '@/components/property/propertyHelpEvents';

/**
 * G2 journey 25: a bar fixed to the bottom edge of a phone screen (the checkout page's Pay bar) publishes its live height in
 * `--pp-sticky-bar-offset` on <body>, so the privacy banner sits on top of it instead of over it (CookieConsentBanner reads the
 * variable; the listing page's Reserve bar publishes it the same way). A bar that is `display: none` at this width measures 0px.
 * The variable is removed when the page is left. Takes the element (hold it in state through a callback ref): the bar is not in the DOM
 * until the page has finished loading its hold.
 */
export function useStickyBarOffset(bar: HTMLElement | null): void {
  useEffect(() => {
    if (!bar || typeof document === 'undefined') return undefined;
    const body = document.body;
    const apply = () => {
      body.style.setProperty(STICKY_BAR_OFFSET_VAR, `${Math.round(bar.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    observer?.observe(bar);
    window.addEventListener('resize', apply);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      body.style.removeProperty(STICKY_BAR_OFFSET_VAR);
    };
  }, [bar]);
}
