/**
 * TASK-8103: guest-portal locale parity with the admin portal (en/hi/te/mr/bn/ta/kn).
 *
 * The load-bearing assertion here is done-when #2: a key that exists in English but is
 * ABSENT from a newly added locale must resolve to the English string — never to an
 * empty string, and never to the raw dotted key. The four new locales are almost
 * entirely fallback (see i18n.ts for the provenance note), so the fallback path is not
 * an edge case in this repo: it is the normal path.
 *
 * Note for whoever edits this next: these tests run in the non-isolated `shared-fast`
 * vitest project, so the localStorage key MUST be restored in afterEach — leaking a
 * non-English value would change what `usePropertyListings` sends to the API as
 * `?locale=` for every later test in the same worker.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import enLocale from './locales/en.json';
import {
  LANGUAGE_SWITCHER_ENABLED,
  getAvailableLanguages,
  getCurrentLanguage,
  getLanguageName,
  getSupportedLanguages,
  translate,
  type Language,
} from './i18n';

const STORAGE_KEY = 'atlas_language';

/** Every leaf (string-valued) dotted path in the English corpus. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return flattenKeys(v as Record<string, unknown>, path);
    }
    return typeof v === 'string' ? [path] : [];
  });
}

const ENGLISH_KEYS = flattenKeys(enLocale as unknown as Record<string, unknown>);
const ALL_LOCALES: Language[] = ['en', 'hi', 'te', 'mr', 'bn', 'ta', 'kn'];

let savedLanguage: string | null = null;

beforeEach(() => {
  savedLanguage = localStorage.getItem(STORAGE_KEY);
});

afterEach(() => {
  if (savedLanguage === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, savedLanguage);
  }
});

describe('TASK-8103 locale parity', () => {
  it('supports the same seven locales the admin portal loads', () => {
    expect(getSupportedLanguages()).toEqual(ALL_LOCALES);
  });

  it.each(['mr', 'bn', 'ta', 'kn'] as const)(
    'resolves %s as the active language when persisted',
    (lang) => {
      localStorage.setItem(STORAGE_KEY, lang);
      expect(getCurrentLanguage()).toBe(lang);
    },
  );

  it('gives every locale a display name in its own script', () => {
    for (const lang of ALL_LOCALES) {
      expect(getLanguageName(lang)).toBeTruthy();
    }
    // Standard endonyms (each language's own name for itself), matching the style of
    // the existing hi/te entries. The admin portal has no display-name map to copy.
    expect(getLanguageName('mr')).toBe('मराठी');
    expect(getLanguageName('bn')).toBe('বাংলা');
    expect(getLanguageName('ta')).toBe('தமிழ்');
    expect(getLanguageName('kn')).toBe('ಕನ್ನಡ');
  });
});

describe('TASK-8103 done-when #2: English fallback, never blank', () => {
  it('falls back to the English string for a key missing from Marathi', () => {
    localStorage.setItem(STORAGE_KEY, 'mr');

    // Guard: without this the fallback assertion below would pass vacuously,
    // because an unsupported language silently resolves to English anyway.
    expect(getCurrentLanguage()).toBe('mr');

    // Proves the mr resource is genuinely wired in: this is the ONE guest key with
    // real sourced Marathi copy (admin `guests` -> guest `searchPage.guests`).
    expect(translate('searchPage.guests')).toBe('पाहुणे');

    // `bookingWidget.book` has no Marathi copy anywhere in the corpus.
    const fellBack = translate('bookingWidget.book');
    expect(fellBack).toBe('Book now');
    expect(fellBack).not.toBe('');
    expect(fellBack).not.toBe('bookingWidget.book');
  });

  it.each(ALL_LOCALES)(
    'never renders an empty string or a raw key for any English key in %s',
    (lang) => {
      localStorage.setItem(STORAGE_KEY, lang);
      expect(ENGLISH_KEYS.length).toBeGreaterThan(0);

      for (const key of ENGLISH_KEYS) {
        const value = translate(key);
        expect(value, `${lang}:${key} rendered empty`).not.toBe('');
        expect(value, `${lang}:${key} leaked the raw key`).not.toBe(key);
        expect(typeof value, `${lang}:${key} was not a string`).toBe('string');
      }
    },
  );

  it('leaves the pre-existing hi/te translations untouched', () => {
    localStorage.setItem(STORAGE_KEY, 'hi');
    expect(translate('bookingWidget.book')).toBe('अभी बुक करें');
    localStorage.setItem(STORAGE_KEY, 'te');
    expect(translate('common.loading')).toBe('లోడ్ చేస్తోంది...');
  });
});

describe('TASK-4517 guard: advertised set stays narrower than the loadable set', () => {
  /**
   * TASK-4517 deliberately hid the switcher because only ~12 keys exist and picking a
   * language changed nothing on screen. That reason still holds, so TASK-8103 widened
   * the LOADABLE set without widening what the product ADVERTISES.
   *
   * `getAvailableLanguages()` is not cosmetic: TenantJsonLd.tsx feeds it straight into
   * public hreflang <link> tags. Returning seven while the switcher is off would tell
   * Google that four locale variants exist which no guest can reach and which render
   * identical English — the SEO version of the exact broken promise TASK-4517 removed.
   */
  it('does not advertise locales a guest cannot actually select', () => {
    expect(LANGUAGE_SWITCHER_ENABLED).toBe(false);
    expect(getAvailableLanguages()).toEqual(['en', 'hi', 'te']);
  });

  it('advertises no more than it can load', () => {
    const loadable = new Set<string>(getSupportedLanguages());
    for (const lang of getAvailableLanguages()) {
      expect(loadable.has(lang)).toBe(true);
    }
  });
});
