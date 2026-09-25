import { describe, it, expect } from 'vitest';
import { isGuestLocale, translateBookingWidget } from './guestLocales';

describe('TASK-102263 multi-language selector', () => {
  it('translates booking widget buttons into Hindi, Marathi, Kannada', () => {
    expect(translateBookingWidget('hi', 'bookNow')).toBe('अभी बुक करें');
    expect(translateBookingWidget('mr', 'checkAvailability')).toBe('उपलब्धता तपासा');
    expect(translateBookingWidget('kn', 'houseRules')).toBe('ಮನೆ ನಿಯಮಗಳು');
  });

  it('translates fee descriptions and validates locale codes', () => {
    expect(translateBookingWidget('hi', 'cleaningFee')).toBe('सफ़ाई शुल्क');
    expect(isGuestLocale('kn')).toBe(true);
    expect(isGuestLocale('fr')).toBe(false);
  });
});
