import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentRecord,
} from "../utils/cookieConsent";

// DPDP-compliant cookie consent banner.
// - Appears only when there is no stored choice (accepted OR rejected).
// - Accept and Reject are given equal visual weight.
// - Rejecting does NOT block access to any part of the site.
// - Clicking the X (close without choice) is NOT treated as consent — banner re-appears next page.
const CookieConsentBanner = () => {
  const [record, setRecord] = useState<CookieConsentRecord | null>(() => {
    // SSR-safe default: no record. We re-read in useEffect after mount.
    return null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRecord(getCookieConsent());
    setReady(true);

    const handler = (e: Event) => {
      const next = (e as CustomEvent<CookieConsentRecord | null>).detail;
      setRecord(next ?? null);
    };
    window.addEventListener("atlas:cookie-consent-changed", handler);
    return () => window.removeEventListener("atlas:cookie-consent-changed", handler);
  }, []);

  if (!ready || record !== null) return null;

  const onAccept = () => setRecord(setCookieConsent("accepted"));
  const onReject = () => setRecord(setCookieConsent("rejected"));

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[9999] px-4 pb-4 md:pb-6"
    >
      <div className="max-w-3xl mx-auto bg-bg-surface border border-border-subtle rounded-2xl shadow-level2 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 space-y-1">
            <h2 id="cookie-consent-title" className="text-base md:text-lg font-bold text-text-primary">
              Your privacy choice
            </h2>
            <p id="cookie-consent-desc" className="text-sm text-text-muted">
              We use strictly necessary cookies to make this site work, and optional analytics cookies
              to understand how it is used. Under India&rsquo;s DPDP Act 2023 we ask for your consent
              before loading anything non-essential. Read our{" "}
              <Link to="/privacy" className="text-primary underline font-semibold">
                privacy notice
              </Link>{" "}
              for details. You can change your choice any time.
            </p>
          </div>
          <div className="flex flex-row gap-2 md:flex-col md:items-stretch shrink-0">
            <button
              type="button"
              onClick={onReject}
              className="px-4 py-4 rounded-xl border border-border-subtle text-text-primary font-semibold hover:border-primary flex-1 md:flex-none"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="px-4 py-4 rounded-xl bg-primary text-[var(--text-contrast)] font-semibold hover:shadow-level2 flex-1 md:flex-none"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
