import { describe, expect, it } from 'vitest';

import { hostCallDigits } from './hostCallDigits';

describe('hostCallDigits', () => {
  it('adds the India country code to a bare 10-digit number, whatever the spacing', () => {
    expect(hostCallDigits('9123456780')).toBe('919123456780');
    expect(hostCallDigits('91234 56780')).toBe('919123456780');
    expect(hostCallDigits('91234-56780')).toBe('919123456780');
  });

  it('turns a leading-0 trunk number into 91 + the 10 digits', () => {
    expect(hostCallDigits('09123456780')).toBe('919123456780');
  });

  it('keeps a number that already carries a country code', () => {
    expect(hostCallDigits('+91 91234 56780')).toBe('919123456780');
    expect(hostCallDigits('919123456780')).toBe('919123456780');
    expect(hostCallDigits('+44 7911 123456')).toBe('447911123456');
  });

  it('gives null for nothing, junk, or a number too short or too long to dial', () => {
    expect(hostCallDigits(undefined)).toBeNull();
    expect(hostCallDigits(null)).toBeNull();
    expect(hostCallDigits('')).toBeNull();
    expect(hostCallDigits('call me')).toBeNull();
    expect(hostCallDigits('12345')).toBeNull();
    expect(hostCallDigits('1234567890123456')).toBeNull();
  });
});
