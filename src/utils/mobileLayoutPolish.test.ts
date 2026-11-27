import { describe, it, expect } from 'vitest';
import {
  MOBILE_393_CLASSNAMES,
  formatGuestCountLabel,
  formatNightsLabel,
} from './mobileLayoutPolish';

describe('GUEST-101 mobileLayoutPolish', () => {
  it('formats singular and plural guest & night labels cleanly', () => {
    expect(formatGuestCountLabel(1)).toBe('1 guest');
    expect(formatGuestCountLabel(2)).toBe('2 guests');
    expect(formatGuestCountLabel(2, 1)).toBe('3 guests (2 adults, 1 child)');
    expect(formatNightsLabel(1)).toBe('1 night');
    expect(formatNightsLabel(4)).toBe('4 nights');
  });

  it('enforces 44px touch targets and overflow-x-hidden for 393px viewports', () => {
    expect(MOBILE_393_CLASSNAMES.pageContainer).toContain('overflow-x-hidden');
    expect(MOBILE_393_CLASSNAMES.primaryCta).toContain('min-h-[44px]');
  });
});
