import { useEffect, useState } from "react";

const STORAGE_KEY = "atlas_cookie_consent";

export type AtlasCookieConsentLevel = "all" | "necessary";

function isAtlasPrimaryHostname(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.replace(/^www\./i, "").toLowerCase();
  // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- domain guard, not user-visible
  return (
    h === "atlashomestays.com" ||
    // Any Atlas subdomain — includes dev.atlashomestays.com so dev + E2E share banner parity.
    // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- domain guard, not user-visible
    h.endsWith(".atlashomestays.com") ||
    h === "atlashomes.in" ||
    h.endsWith(".atlashomes.in") ||
    // Local dev and CI environments.
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

function readConsent(): AtlasCookieConsentLevel | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "all" || v === "necessary") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * DPDP cookie consent (TASK-1946): fixed bar on first visit only on primary Atlas hostnames.
 * White-label / other hosts: no banner.
 */
const CookieConsent = () => {
  const [level, setLevel] = useState<AtlasCookieConsentLevel | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLevel(readConsent());
    setReady(true);
  }, []);

  if (!ready || level !== null || !isAtlasPrimaryHostname()) return null;

  const save = (next: AtlasCookieConsentLevel) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      // Let main.tsx / analytics lazily initialise GA after consent (DPDP Act §6).
      window.dispatchEvent(
        new CustomEvent<AtlasCookieConsentLevel>("atlas:cookie-consent-changed", { detail: next }),
      );
    } catch {
      /* private mode / quota */
    }
    setLevel(next);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="atlas-cookie-consent-title"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[9999] flex items-center justify-between gap-3 border-t border-border-subtle bg-white px-4 py-3 shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id="atlas-cookie-consent-title" className="text-sm text-text-primary">
          We use cookies for essential site features and, with your consent, analytics. Choose how we may use optional
          cookies under India&apos;s DPDP Act.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg-muted"
            onClick={() => save("necessary")}
          >
            Necessary only
          </button>
          <button
            type="button"
            className="rounded-lg bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] hover:opacity-95"
            onClick={() => save("all")}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
