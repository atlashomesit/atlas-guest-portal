/**
 * Razorpay's checkout window can fail to open WITHOUT telling the page: an in-app browser (Instagram, Facebook) that blocks it, or an
 * order the gateway rejects. Its own script alerts "Oops! Something went wrong", hides its container again, and fires neither `close`
 * nor `payment.failed`, so the Pay button would stay on "Securing your booking..." for the rest of the hold.
 *
 * This is the pure decision, fed once a second with whether Razorpay's container (`.razorpay-container`) is on screen:
 *  - seen on screen, then hidden for `hiddenAfterShownMs` with no event -> the window died (the usual signature);
 *  - never on screen for `neverShownMs` -> it never opened (slow networks are given far longer than a dead window).
 * A missing container is "unknown": never a failure.
 */
export interface RazorpayWindowWatch {
  /** `visible`: true / false, or null when the container element does not exist. Returns true once the window is judged dead. */
  tick(visible: boolean | null, nowMs: number): boolean;
}

export function createRazorpayWindowWatch(
  startedAtMs: number,
  opts: { hiddenAfterShownMs?: number; neverShownMs?: number } = {},
): RazorpayWindowWatch {
  const hiddenAfterShownMs = opts.hiddenAfterShownMs ?? 4_000;
  const neverShownMs = opts.neverShownMs ?? 15_000;
  let sawVisible = false;
  let hiddenSinceMs: number | null = null;

  return {
    tick(visible, nowMs) {
      if (visible === null) return false;
      if (visible) {
        sawVisible = true;
        hiddenSinceMs = null;
        return false;
      }
      if (hiddenSinceMs === null) hiddenSinceMs = sawVisible ? nowMs : startedAtMs;
      return nowMs - hiddenSinceMs >= (sawVisible ? hiddenAfterShownMs : neverShownMs);
    },
  };
}

/** True when Razorpay's container is displayed; null when the element does not exist. */
export function isRazorpayContainerVisible(doc: Document = document, win: Window = window): boolean | null {
  const el = doc.querySelector('.razorpay-container') as HTMLElement | null;
  if (!el) return null;
  return win.getComputedStyle(el).display !== 'none';
}
