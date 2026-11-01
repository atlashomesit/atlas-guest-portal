import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentRecord,
} from "../utils/cookieConsent";
import { getTenantContext } from "../tenant/tenantContext";
import { getGuestDataProcessingEntityName } from "../tenant/displayBrand";
import { getTenantOverrides } from "../tenant/tenantOverrides"; // TASK-1877

const DISMISS_KEY = "atlas:cookie-banner-dismissed";
const readSessionDismissed = (): boolean => {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};
const writeSessionDismissed = () => {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* storage blocked: the bar still hides for this page view via component state */
  }
};

// DPDP-compliant cookie consent banner.
// - Appears only when there is no stored choice (accepted OR rejected).
// - Accept and Reject are given equal visual weight.
// - Rejecting does NOT block access to any part of the site.
// - Clicking the X (close without choice) is NOT treated as consent — banner re-appears next page.
// - TASK-1877: banner copy + privacy link are tenant-aware for white-label subdomains.
const CookieConsentBanner = ({ inline = false }: { inline?: boolean }) => {
  const [record, setRecord] = useState<CookieConsentRecord | null>(() => {
    // SSR-safe default: no record. We re-read in useEffect after mount.
    return null;
  });
  const [ready, setReady] = useState(false);
  // GUEST-048: "Not now" hides the floating bar for this browser session only. It is NOT a consent choice, nothing is
  // stored in the consent record, and the banner returns in the next session.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setRecord(getCookieConsent());
    setDismissed(readSessionDismissed());
    setReady(true);

    const handler = (e: Event) => {
      const next = (e as CustomEvent<CookieConsentRecord | null>).detail;
      setRecord(next ?? null);
    };
    window.addEventListener("atlas:cookie-consent-changed", handler);
    return () => window.removeEventListener("atlas:cookie-consent-changed", handler);
  }, []);

  if (!ready || record !== null) return null;
  if (dismissed && !inline) return null;
  const onAccept = () => setRecord(setCookieConsent("accepted"));
  const onReject = () => setRecord(setCookieConsent("rejected"));
  const onDismiss = () => {
    writeSessionDismissed();
    setDismissed(true);
  };
  // GUEST-008: resolve per-tenant banner copy and privacy link from API context, then overrides
  const tenantCtx = getTenantContext();
  const tenantOverrides = getTenantOverrides(tenantCtx?.slug);
  const cookieBannerConfig = tenantCtx?.cookieBanner ?? tenantOverrides.cookieBanner;

  const bannerTitle = cookieBannerConfig?.title ?? "Your privacy choice";
  // Marketplace apex resolves to "Atlastays" (full brand baseline post-2026-05 rebrand);
  // white-label tenants use legal/long brand from context. Aligns with
  // cookie-consent-compliance.e2e.spec.ts which asserts banner copy starts with
  // "Atlastays uses" on the marketplace and "Star Guest House uses" on tenant subdomains.
  const bannerText = cookieBannerConfig?.text ??
    `${getGuestDataProcessingEntityName()} uses strictly necessary cookies to make this site work, and optional analytics cookies ` +
    "to understand how it is used. Under India’s DPDP Act 2023 we ask for your consent " +
    "before loading anything non-essential. Read our";
  const privacyUrl = cookieBannerConfig?.privacyUrl ?? "/privacy";
  const privacyLinkLabel = cookieBannerConfig?.privacyLinkLabel ?? "privacy notice";

  // GUEST-048: on a phone the full notice (title + 6 lines + two stacked-looking buttons) filled ~40% of the screen and
  // sat over the hero and the Reserve bar. Floating mode is now a compact bar: no heading on small screens (still the
  // dialog's accessible name), a short sentence + the same privacy link, equal-weight choices on one row, and a close
  // control that hides it for the session without recording any consent.
  const entityName = (getGuestDataProcessingEntityName() ?? "").trim();
  const compactText = `${entityName || "This site"} uses cookies. Optional analytics cookies load only if you accept. `;
  const useCompactCopy = !cookieBannerConfig?.text;

  return (
    <div
      role={inline ? "region" : "dialog"}
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      data-testid="cookie-consent-banner"
      className={inline ? "home-privacy-choice" : "fixed inset-x-0 bottom-0 z-[9999] px-3 pb-3 md:px-4 md:pb-6"}
    >
      <div className="relative max-w-3xl mx-auto bg-bg-surface border border-border-subtle rounded-2xl shadow-level2 p-3 md:p-6">
        {!inline && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss for now (no choice saved)"
            data-testid="cookie-consent-dismiss"
            className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:text-text-primary"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        )}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className={inline ? "flex-1 space-y-1" : "flex-1 space-y-1 pr-10"}>
            <h2 id="cookie-consent-title" className={inline ? "text-base md:text-lg font-bold text-text-primary" : "sr-only md:not-sr-only text-base md:text-lg font-bold text-text-primary"}>
              {bannerTitle}
            </h2>
            <p id="cookie-consent-desc" className="text-xs md:text-sm text-text-muted">
              {useCompactCopy && !inline && (
                <span className="md:hidden" data-testid="cookie-consent-compact-copy">
                  {compactText}
                </span>
              )}
              <span className={useCompactCopy && !inline ? "hidden md:inline" : undefined}>
                {bannerText}{" "}
              </span>
              <Link to={privacyUrl} className="text-primary underline font-semibold">
                {privacyLinkLabel}
              </Link>
              <span className={useCompactCopy && !inline ? "hidden md:inline" : undefined}>
                {" "}for details. You can change your choice any time.
              </span>
            </p>
          </div>
          <div className="flex flex-row gap-2 md:flex-col md:items-stretch shrink-0">
            <button
              type="button"
              onClick={onReject}
              className="px-3 py-2 md:px-4 md:py-3 min-h-11 rounded-xl border border-border-subtle text-text-primary text-sm md:text-base font-semibold hover:border-primary flex-1 md:flex-none"
            >
              Reject non-essential
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="px-3 py-2 md:px-4 md:py-3 min-h-11 rounded-xl border border-border-subtle text-text-primary text-sm md:text-base font-semibold hover:border-primary flex-1 md:flex-none"
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
