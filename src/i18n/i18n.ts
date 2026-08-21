// Minimal i18n implementation without external dependencies
// Supports EN, HI (Hindi), TE (Telugu), MR (Marathi), BN (Bengali), TA (Tamil), KN (Kannada)

import enLocale from './locales/en.json';
import hiLocale from './locales/hi.json';
import teLocale from './locales/te.json';
// TASK-8103: locale-set parity with atlas-admin-portal (added there by TASK-1740…1743).
import mrLocale from './locales/mr.json'; // TASK-1740: Marathi (Pune market)
import bnLocale from './locales/bn.json'; // TASK-1741: Bengali (Kolkata + NE markets)
import taLocale from './locales/ta.json'; // TASK-1742: Tamil (Chennai market)
import knLocale from './locales/kn.json'; // TASK-1743: Kannada (Bangalore market)

/**
 * TASK-8103 — PROVENANCE OF mr/bn/ta/kn, read before adding keys to those files.
 *
 * These four files are near-empty ON PURPOSE. The brief was to reuse the admin portal's
 * translation files "where keys overlap"; measured against
 * atlas-admin-portal/src/i18n/locales, the real overlap is:
 *
 *   - exact dotted-key overlap ....................... 0 of 12
 *     (the two portals share no namespaces at all: guest has searchPage/listingDetail/
 *      bookingWidget/common, admin has dashboard/calendar/reservations/…)
 *   - guest English value found verbatim in admin en .. 4 of 12
 *   - …and actually TRANSLATED in mr/bn/ta/kn ........ 1 of 12  → searchPage.guests
 *
 * The other three value-matches ("Check-in", "Check-out", "Loading...") are still
 * literal English inside the admin's own mr/bn/ta/kn files — 36 of that corpus's 108
 * keys are untranslated placeholders — so copying them would add nothing the English
 * fallback does not already do, while making these files look more finished than they are.
 *
 * Everything not present here therefore falls back to English by design (done-when #2),
 * which src/i18n/i18n.test.ts asserts exhaustively. Do NOT pad these files with
 * machine-translated or invented copy; add a key only when real translated copy exists.
 */
const locales = {
  en: enLocale,
  hi: hiLocale,
  te: teLocale,
  mr: mrLocale,
  bn: bnLocale,
  ta: taLocale,
  kn: knLocale,
};

export type Language = keyof typeof locales;

/**
 * Every locale this portal can LOAD. Not the same thing as what it advertises —
 * see getAvailableLanguages() below.
 *
 * NOTE: the guest portal's storage key is `atlas_language`; the admin portal's is
 * `atlas-lang`. They are deliberately NOT shared (different origins, different
 * supported-copy levels) — do not "unify" them without checking both initialisers.
 */
const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'hi', 'te', 'mr', 'bn', 'ta', 'kn'];

/**
 * The locales the product advertises when the switcher is OFF (kept for the rollback
 * path — see LANGUAGE_SWITCHER_ENABLED). Not read while the switcher is on: with the
 * flag true, getAvailableLanguages() returns the full SUPPORTED_LANGUAGES set instead.
 */
const ADVERTISED_LANGUAGES: readonly Language[] = ['en', 'hi', 'te'];

const STORAGE_KEY = 'atlas_language';
const DEFAULT_LANGUAGE: Language = 'en';

/**
 * TASK-4517: Language switcher visibility flag (gate until coverage is real).
 * TASK-8103 (2026-08-20): left OFF pending fallback verification — see prior note in
 * git history for the "selecting Hindi changed nothing" concern.
 *
 * TASK-8103 (2026-08-21, orchestrator product ruling): turned ON. The concern above is
 * unchanged by this task (the guest app still has ~12 real translation keys and most of
 * the booking flow is hardcoded English regardless of locale) — but that is exactly what
 * translate()'s English fallback already produces: picking Marathi shows an English page,
 * not a blank or broken one, which is the documented bar for shipping this switcher (see
 * i18n.test.ts "TASK-8103 done-when #2"). Re-tightening this requires the same translation
 * investment as before; it's a product call, not a plumbing one, and it stays open in
 * TASK-4517 for that follow-up. This flag only controls whether the switcher is reachable.
 */
export const LANGUAGE_SWITCHER_ENABLED = true;

function isLanguage(value: string | null): value is Language {
  return value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Get the current user language preference from localStorage, or default to EN
 */
export function getCurrentLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

/**
 * Set the user language preference in localStorage
 */
export function setLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

/**
 * Nested key access helper: get(obj, "a.b.c") → obj.a.b.c
 */
function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Translate a key (dot-separated path) for the current language.
 * Falls back to English, then to the key itself — never to an empty string.
 */
export function translate(key: string): string {
  const lang = getCurrentLanguage();
  const locale: Record<string, any> = locales[lang];
  const translated = getNestedValue(locale, key);
  if (translated) {
    return translated;
  }
  // Fallback to English
  const fallback = getNestedValue(locales.en, key);
  return fallback || key;
}

/**
 * Every locale whose resource bundle is loaded and resolvable.
 */
export function getSupportedLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Locales offered to the guest.
 *
 * This is NOT cosmetic and is NOT the same as getSupportedLanguages(): TenantJsonLd.tsx
 * feeds this straight into public hreflang <link rel="alternate"> tags. It tracks
 * LANGUAGE_SWITCHER_ENABLED so the switcher and the SEO hreflang set never diverge —
 * with the flag on (TASK-8103), both advertise the full seven-locale set; if it is ever
 * turned back off, both narrow to ADVERTISED_LANGUAGES together, with no second place to
 * remember to update.
 */
export function getAvailableLanguages(): Language[] {
  return LANGUAGE_SWITCHER_ENABLED ? [...SUPPORTED_LANGUAGES] : [...ADVERTISED_LANGUAGES];
}

/**
 * Get friendly name for a language (endonym — the language's own name for itself)
 */
export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    hi: 'हिन्दी',
    te: 'తెలుగు',
    mr: 'मराठी',
    bn: 'বাংলা',
    ta: 'தமிழ்',
    kn: 'ಕನ್ನಡ',
  };
  return names[lang];
}
