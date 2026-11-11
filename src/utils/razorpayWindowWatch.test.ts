import { describe, expect, it } from 'vitest';
import { createRazorpayWindowWatch, isRazorpayContainerVisible } from './razorpayWindowWatch';

describe('razorpayWindowWatch', () => {
  it('a window that opened and is still on screen is never a failure', () => {
    const w = createRazorpayWindowWatch(0);
    for (let t = 1_000; t <= 120_000; t += 1_000) expect(w.tick(true, t)).toBe(false);
  });

  it('shown, then hidden with no event for 4 s = the window died (Razorpay alerted and hid itself)', () => {
    const w = createRazorpayWindowWatch(0);
    expect(w.tick(true, 1_000)).toBe(false);
    expect(w.tick(true, 5_000)).toBe(false);
    expect(w.tick(false, 6_000)).toBe(false); // hidden just now
    expect(w.tick(false, 9_000)).toBe(false); // 3 s
    expect(w.tick(false, 10_000)).toBe(true); // 4 s
  });

  it('a flicker is forgiven: hidden then shown again resets the clock', () => {
    const w = createRazorpayWindowWatch(0);
    expect(w.tick(true, 1_000)).toBe(false);
    expect(w.tick(false, 2_000)).toBe(false);
    expect(w.tick(true, 4_000)).toBe(false);
    expect(w.tick(false, 5_000)).toBe(false);
    expect(w.tick(false, 8_000)).toBe(false);
    expect(w.tick(false, 9_000)).toBe(true);
  });

  it('never shown at all: a slow network gets 15 s before it counts as "did not open"', () => {
    const w = createRazorpayWindowWatch(1_000);
    expect(w.tick(false, 2_000)).toBe(false);
    expect(w.tick(false, 10_000)).toBe(false);
    expect(w.tick(false, 15_999)).toBe(false);
    expect(w.tick(false, 16_000)).toBe(true);
  });

  it('a missing container is "unknown", never a failure', () => {
    const w = createRazorpayWindowWatch(0);
    for (let t = 1_000; t <= 60_000; t += 1_000) expect(w.tick(null, t)).toBe(false);
  });

  it('reads the real container: absent = null, displayed = true, display:none = false', () => {
    expect(isRazorpayContainerVisible()).toBeNull();
    const el = document.createElement('div');
    el.className = 'razorpay-container';
    el.style.display = 'block';
    document.body.appendChild(el);
    expect(isRazorpayContainerVisible()).toBe(true);
    el.style.display = 'none';
    expect(isRazorpayContainerVisible()).toBe(false);
    el.remove();
  });
});
