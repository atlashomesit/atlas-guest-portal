import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * TASK-016: DPDP 2023 / Indian Digital Personal Data Protection Act compliance.
 *
 * Cookie consent banner — surfaced once per device until a choice is made.
 * DPDP 2023 requires explicit, specific, informed consent for cookies beyond
 * those strictly necessary (session/auth). Atlas uses:
 *   - Strictly necessary: auth session, tenant slug, booking cart context (always on)
 *   - Analytics: Cloudflare Web Analytics (no PII, no cross-site tracking) — user opt-in
 *   - Marketing: none
 *
 * State is persisted in localStorage under "atlas.cookie-consent.v1" with shape:
 *   { choice: "all" | "necessary-only", timestamp: ISO8601 }
 *
 * Re-prompt is triggered if:
 *   - Key missing (new device / cleared storage)
 *   - Schema version bumped (v1 → v2 etc.)
 */

export const CONSENT_KEY = "atlas.cookie-consent.v1";

export type ConsentChoice = "all" | "necessary-only";

export interface ConsentRecord {
  choice: ConsentChoice;
  timestamp: string;
}

export function getConsent(): ConsentRecord | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CONSENT_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (parsed && (parsed.choice === "all" || parsed.choice === "necessary-only")) {
      return { choice: parsed.choice, timestamp: parsed.timestamp ?? new Date().toISOString() };
    }
  } catch {
    /* ignore malformed entry */
  }
  return null;
}

export function setConsent(choice: ConsentChoice): void {
  try {
    const record: ConsentRecord = { choice, timestamp: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    // Dispatch event so analytics loader can start/stop accordingly.
    window.dispatchEvent(new CustomEvent("atlas:cookie-consent-changed", { detail: record }));
  } catch {
    /* storage may be unavailable in privacy mode — banner will re-show, acceptable */
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Avoid hydration flash — decide after mount.
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  const accept = (choice: ConsentChoice) => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle bg-bg-surface shadow-level2"
      data-testid="cookie-consent-banner"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p id="cookie-consent-title" className="text-sm font-semibold text-text-primary">
            Your privacy matters
          </p>
          <p id="cookie-consent-body" className="mt-1 text-xs text-text-secondary">
            We use cookies strictly necessary for booking, and optional anonymous analytics (no PII, no
            cross-site tracking) to improve the site. You can change your choice any time. See our{" "}
            <Link to="/privacy" className="text-brand-primary underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => accept("necessary-only")}
            className="min-h-[44px] rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted"
            data-testid="cookie-consent-necessary"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => accept("all")}
            className="min-h-[44px] rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            data-testid="cookie-consent-accept-all"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
