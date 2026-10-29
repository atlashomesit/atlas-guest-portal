import { describe, expect, it } from 'vitest';
import { brandNameForSentence, saveVsOtaAmount } from './guestCopy';

describe('GUEST-048 guestCopy', () => {
  it('saveVsOtaAmount is null for a missing, zero, negative or non-finite price (so nothing, not a bare 0, is rendered)', () => {
    for (const price of [0, -5, null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(saveVsOtaAmount(price)).toBeNull();
    }
  });

  it('saveVsOtaAmount keeps the existing 2 nights x 15.5% figure for a real price', () => {
    expect(saveVsOtaAmount(3000)).toBe(930);
    expect(saveVsOtaAmount(4500)).toBe(1395);
  });

  it('brandNameForSentence drops trailing full stops only', () => {
    expect(brandNameForSentence('Grove & Co.')).toBe('Grove & Co');
    expect(brandNameForSentence('Grove & Co..')).toBe('Grove & Co');
    expect(brandNameForSentence('  Atlas Homes ')).toBe('Atlas Homes');
    expect(brandNameForSentence('St. Mary Stays')).toBe('St. Mary Stays');
  });
});
