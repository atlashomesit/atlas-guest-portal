// Minimal i18n implementation without external dependencies
// Supports EN, HI (Hindi), TE (Telugu)

import enLocale from './locales/en.json';
import hiLocale from './locales/hi.json';
import teLocale from './locales/te.json';

export type Language = 'en' | 'hi' | 'te';

const locales = {
  en: enLocale,
  hi: hiLocale,
  te: teLocale,
};

const STORAGE_KEY = 'atlas_language';
const DEFAULT_LANGUAGE: Language = 'en';

/**
 * TASK-4517: Language switcher visibility flag (gate until coverage is real).
 * Currently only ~12 i18n keys exist; Navbar itself is the only consumer.
 * Threshold for re-enable: search + booking + confirmation flows translated.
 * TODO: Add full coverage for core guest flows before enabling.
 */
export const LANGUAGE_SWITCHER_ENABLED = false;

/**
 * Get the current user language preference from localStorage, or default to EN
 */
export function getCurrentLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'hi' || saved === 'te') {
    return saved;
  }
  return DEFAULT_LANGUAGE;
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
 * Translate a key (dot-separated path) for the current language
 */
export function translate(key: string): string {
  const lang = getCurrentLanguage();
  const locale = locales[lang];
  const translated = getNestedValue(locale, key);
  if (translated) {
    return translated;
  }
  // Fallback to English
  const fallback = getNestedValue(locales.en, key);
  return fallback || key;
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): Language[] {
  return ['en', 'hi', 'te'];
}

/**
 * Get friendly name for a language
 */
export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    hi: 'हिन्दी',
    te: 'తెలుగు',
  };
  return names[lang];
}
