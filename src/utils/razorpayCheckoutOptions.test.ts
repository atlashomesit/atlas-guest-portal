import { describe, expect, it } from 'vitest';
import {
  buildRazorpayCheckoutDisplayConfig,
  isMobileCheckoutUserAgent,
} from './razorpayCheckoutOptions';

describe('isMobileCheckoutUserAgent (TASK-5202)', () => {
  it('detects common mobile user agents', () => {
    expect(isMobileCheckoutUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMobileCheckoutUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe(true);
  });

  it('returns false for desktop user agents', () => {
    expect(isMobileCheckoutUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(false);
    expect(isMobileCheckoutUserAgent('')).toBe(false);
  });
});

describe('buildRazorpayCheckoutDisplayConfig (TASK-5202)', () => {
  const savedVpa = 'guest@upi';

  it('uses UPI Intent on mobile and does not pin a saved VPA', () => {
    const result = buildRazorpayCheckoutDisplayConfig(savedVpa, true);
    expect(result.upi).toEqual({ flow: 'intent' });
    expect(result.prefillExtras).toEqual({});
    expect(result.config.display.blocks.upi_block.instruments[0]).toMatchObject({
      method: 'upi',
      flows: ['intent', 'collect'],
    });
    expect(result.config.display.sequence).toContain('block.card');
  });

  it('uses saved VPA collect fallback on desktop', () => {
    const result = buildRazorpayCheckoutDisplayConfig(savedVpa, false);
    expect(result.upi).toEqual({ vpa: savedVpa });
    expect(result.prefillExtras).toEqual({ vpa: savedVpa, method: 'upi' });
  });

  it('omits VPA pinning on desktop when no saved VPA', () => {
    const result = buildRazorpayCheckoutDisplayConfig('', false);
    expect(result.upi).toBeUndefined();
    expect(result.prefillExtras).toEqual({});
    expect(result.config.display.blocks.card_block.instruments[0]).toEqual({ method: 'card' });
  });
});
