import { describe, it, expect } from 'vitest';
import {
  formatCleanInternationalPhone,
  cleanWaPhoneDigits,
} from './BookingConfirmationPage';

describe('BookingConfirmationPage (TASK-103121: Phone formatting & WhatsApp CTA link)', () => {
  describe('formatCleanInternationalPhone', () => {
    it('formats a 10-digit Indian national number with +91', () => {
      expect(formatCleanInternationalPhone('9876543210')).toBe('+919876543210');
    });

    it('formats a 12-digit Indian number starting with 91 with +', () => {
      expect(formatCleanInternationalPhone('919876543210')).toBe('+919876543210');
    });

    it('preserves existing + format', () => {
      expect(formatCleanInternationalPhone('+919876543210')).toBe('+919876543210');
      expect(formatCleanInternationalPhone('+14155552671')).toBe('+14155552671');
    });

    it('handles numbers with spaces, hyphens and parentheses', () => {
      expect(formatCleanInternationalPhone('+91 98765-43210')).toBe('+919876543210');
    });

    it('returns empty string for null, undefined or empty input', () => {
      expect(formatCleanInternationalPhone('')).toBe('');
      expect(formatCleanInternationalPhone(null)).toBe('');
      expect(formatCleanInternationalPhone(undefined)).toBe('');
    });
  });

  describe('cleanWaPhoneDigits', () => {
    it('strips all non-digit characters and prepends 91 for 10-digit Indian numbers', () => {
      expect(cleanWaPhoneDigits('9876543210')).toBe('919876543210');
      expect(cleanWaPhoneDigits('+91 98765 43210')).toBe('919876543210');
      expect(cleanWaPhoneDigits('+91-9876543210')).toBe('919876543210');
      expect(cleanWaPhoneDigits('919876543210')).toBe('919876543210');
    });

    it('leaves international numbers with dial code clean of special characters', () => {
      expect(cleanWaPhoneDigits('+1 (415) 555-2671')).toBe('14155552671');
    });

    it('constructs a standard clean wa.me URL without extraneous spaces or special characters', () => {
      const cleanPhone = cleanWaPhoneDigits('+91 98765 43210');
      const text = encodeURIComponent('Hi, I have a question');
      const url = `https://wa.me/${cleanPhone}?text=${text}`;
      expect(url).toBe('https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20question');
      expect(url).not.toMatch(/[ +()-]/);
    });
  });
});
