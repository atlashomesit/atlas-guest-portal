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

describe('TASK-8103: switcher enabled, advertised set now equals the loadable set', () => {
  /**
   * TASK-4517 originally hid the switcher because only ~12 keys exist and picking a
   * language changed nothing on screen. TASK-8103's orchestrator ruling (2026-08-21)
   * turned the switcher on anyway: the English-fallback tests above prove picking mr/
   * bn/ta/kn (or hi/te, which have the same coverage gap) degrades to a fully-English
   * page rather than a blank or broken one, which is the documented bar for shipping.
   *
   * `getAvailableLanguages()` is not cosmetic: TenantJsonLd.tsx feeds it straight into
   * public hreflang <link> tags, so it must track the switcher's on/off state exactly —
   * asserted below so the two can never silently diverge again.
   */
  it('advertises exactly what the switcher can now select', () => {
    expect(LANGUAGE_SWITCHER_ENABLED).toBe(true);
    expect(getAvailableLanguages()).toEqual(ALL_LOCALES);
  });

  it('advertises no more than it can load', () => {
    const loadable = new Set<string>(getSupportedLanguages());
    for (const lang of getAvailableLanguages()) {
      expect(loadable.has(lang)).toBe(true);
    }
  });
});

describe('TASK-8103: script/glyph coverage — endonyms and translated strings use the right Unicode block', () => {
  /**
   * A unit test cannot render a font, so it cannot prove glyphs paint on screen. What it
   * CAN prove — and what actually catches the class of bug this matters for (mojibake,
   * a pasted-in wrong-script string, a mis-mapped locale key) — is that every visible
   * string for a given language falls in that language's Unicode script block, not in
   * Latin (which would mean it silently leaked English/ASCII) and not in some other
   * Indic script (which would mean a copy-paste mixup between locale files).
   */
  // \s covers plain whitespace; the extra literals cover punctuation and joiners that
  // legitimately appear inside otherwise-native-script strings (hyphen in "चेक-इन",
  // ZWNJ/ZWJ in Telugu/Devanagari conjuncts, "…" in loading copy) without opening the
  // door to actual Latin letters or digits leaking through.
  const NEUTRAL = '\\s\\-.,!?…&‌‍';
  const SCRIPT_RANGES: Record<Exclude<Language, 'en'>, RegExp> = {
    hi: new RegExp(`^[ऀ-ॿ${NEUTRAL}]+$`), // Devanagari
    mr: new RegExp(`^[ऀ-ॿ${NEUTRAL}]+$`), // Devanagari
    te: new RegExp(`^[ఀ-౿${NEUTRAL}]+$`), // Telugu
    bn: new RegExp(`^[ঀ-৿${NEUTRAL}]+$`), // Bengali
    ta: new RegExp(`^[஀-௿${NEUTRAL}]+$`), // Tamil
    kn: new RegExp(`^[ಀ-೿${NEUTRAL}]+$`), // Kannada
  };

  it.each(Object.keys(SCRIPT_RANGES) as Array<Exclude<Language, 'en'>>)(
    "renders %s's endonym in its own script block, not Latin or another Indic script",
    (lang) => {
      const name = getLanguageName(lang);
      expect(name).toMatch(SCRIPT_RANGES[lang]);
    },
  );

  it.each(Object.keys(SCRIPT_RANGES) as Array<Exclude<Language, 'en'>>)(
    'renders every real (non-fallback) translated string for %s in its own script block',
    (lang) => {
      localStorage.setItem(STORAGE_KEY, lang);
      let realTranslationCount = 0;
      for (const key of ENGLISH_KEYS) {
        const value = translate(key);
        // A value differs from the English corpus only when a real translation exists
        // for that key in this locale (the stub locales have exactly one such key today).
        if (value !== getEnglishValue(key)) {
          realTranslationCount += 1;
          expect(value, `${lang}:${key} = "${value}" is not in the ${lang} script block`).toMatch(
            SCRIPT_RANGES[lang],
          );
        }
      }
      // Guard against a vacuous pass: every locale under test has at least one real key.
      expect(realTranslationCount).toBeGreaterThan(0);
    },
  );
});

function getEnglishValue(key: string): string {
  return translateFromLocale(enLocale as unknown as Record<string, unknown>, key) ?? key;
}

function translateFromLocale(locale: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = locale;
  for (const k of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[k];
  }
  return typeof current === 'string' ? current : undefined;
}
