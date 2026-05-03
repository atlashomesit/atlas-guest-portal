// Cookie consent state for DPDP Act 2023 compliance.
//
// The DPDP Act requires consent to be:
//   - freely given, informed, and unambiguous (Section 6)
//   - as easy to withdraw as to give (Rule 3 DPDP Rules 2025)
//
// We persist the user's choice (and the timestamp + notice version at the moment of choice)
// so we have a consent record, per Section 6(6) of the DPDP Act.

export const COOKIE_CONSENT_STORAGE_KEY = "atlas.cookieConsent.v1";
export const COOKIE_CONSENT_NOTICE_VERSION = "2026-04-22";

export type CookieConsentChoice = "accepted" | "rejected";

export type CookieConsentRecord = {
  choice: CookieConsentChoice;
  at: string; // ISO 8601 timestamp
  noticeVersion: string;
};

export function getCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentRecord>;
    if (
      parsed &&
      (parsed.choice === "accepted" || parsed.choice === "rejected") &&
      typeof parsed.at === "string" &&
      typeof parsed.noticeVersion === "string"
    ) {
      return parsed as CookieConsentRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: CookieConsentChoice): CookieConsentRecord {
  const record: CookieConsentRecord = {
    choice,
    at: new Date().toISOString(),
    noticeVersion: COOKIE_CONSENT_NOTICE_VERSION,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
      // Emit a window event so other tabs / components can react.
      window.dispatchEvent(new CustomEvent("atlas:cookie-consent-changed", { detail: record }));
    } catch {
      // Swallow storage errors (Safari private mode, disabled storage). Consent still applies in-memory.
    }
  }
  return record;
}

/** TASK-1946: DPDP banner v2 key (plain string: all | necessary). */
const ATLAS_COOKIE_CONSENT_V2 = "atlas_cookie_consent";

export function resetCookieConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    window.localStorage.removeItem(ATLAS_COOKIE_CONSENT_V2);
    window.dispatchEvent(new CustomEvent("atlas:cookie-consent-changed", { detail: null }));
  } catch {
    // ignore
  }
}

export function hasAcceptedCookies(): boolean {
  if (typeof window !== "undefined") {
    try {
      const v2 = window.localStorage.getItem(ATLAS_COOKIE_CONSENT_V2);
      if (v2 === "all") return true;
      if (v2 === "necessary") return false;
    } catch {
      /* ignore */
    }
  }
  return getCookieConsent()?.choice === "accepted";
}
