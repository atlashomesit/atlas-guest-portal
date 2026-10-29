import { describe, expect, it } from 'vitest';
import * as guestCopy from './guestCopy';
import { brandNameForSentence } from './guestCopy';

describe('GUEST-048 / GUEST-037 guestCopy', () => {
  it('GUEST-037: no invented "save vs OTA" helper is exported (a fixed-% saving is not a real quote figure)', () => {
    expect(Object.keys(guestCopy)).not.toContain('saveVsOtaAmount');
  });

  it('brandNameForSentence drops trailing full stops only', () => {
    expect(brandNameForSentence('Grove & Co.')).toBe('Grove & Co');
    expect(brandNameForSentence('Grove & Co..')).toBe('Grove & Co');
    expect(brandNameForSentence('  Atlas Homes ')).toBe('Atlas Homes');
    expect(brandNameForSentence('St. Mary Stays')).toBe('St. Mary Stays');
  });
});
