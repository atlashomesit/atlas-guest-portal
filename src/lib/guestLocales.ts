/**
 * TASK-102263 — Multi-language selector (en/hi/mr/kn) for direct booking pages.
 */

export type GuestLocale = 'en' | 'hi' | 'mr' | 'kn';

export const GUEST_LOCALES: GuestLocale[] = ['en', 'hi', 'mr', 'kn'];

export type BookingWidgetKey = 'bookNow' | 'checkAvailability' | 'cleaningFee' | 'houseRules';

export const BOOKING_WIDGET_STRINGS: Record<GuestLocale, Record<BookingWidgetKey, string>> = {
  en: { bookNow: 'Book Now', checkAvailability: 'Check Availability', cleaningFee: 'Cleaning fee', houseRules: 'House rules' },
  hi: { bookNow: 'अभी बुक करें', checkAvailability: 'उपलब्धता देखें', cleaningFee: 'सफ़ाई शुल्क', houseRules: 'घर के नियम' },
  mr: { bookNow: 'आत्ता बुक करा', checkAvailability: 'उपलब्धता तपासा', cleaningFee: 'स्वच्छता शुल्क', houseRules: 'घराचे नियम' },
  kn: { bookNow: 'ಈಗ ಬುಕ್ ಮಾಡಿ', checkAvailability: 'ಲಭ್ಯತೆ ಪರಿಶೀಲಿಸಿ', cleaningFee: 'ಶುಚಿಗೊಳಿಸುವ ಶುಲ್ಕ', houseRules: 'ಮನೆ ನಿಯಮಗಳು' },
};

export function translateBookingWidget(locale: GuestLocale, key: BookingWidgetKey): string {
  return BOOKING_WIDGET_STRINGS[locale]?.[key] ?? BOOKING_WIDGET_STRINGS.en[key];
}

export function isGuestLocale(value: string): value is GuestLocale {
  return (GUEST_LOCALES as string[]).includes(value);
}
