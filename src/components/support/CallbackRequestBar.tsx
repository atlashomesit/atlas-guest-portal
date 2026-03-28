import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiPhoneCall, FiX } from "react-icons/fi";
import { matchPath, useLocation } from "react-router-dom";

import { trackEvent } from "../../utils/analytics";
import { submitCallbackLead } from "../../utils/callbackLeads";
import { hasVisibleModal } from "../../utils/modals";

interface CallbackRequestBarProps {
  hidden?: boolean;
}

const HIDE_KEY = "callback_bar_hidden_until";
const HIDE_DURATION_MS = 24 * 60 * 60 * 1000;
const VIEW_DELAY_MS = 10_000;
const SCROLL_THRESHOLD = 0.25;

const isValidIndiaPhone = (value: string) => /^[6-9]\d{9}$/.test(value);
const listingPrefixes = ["/property_details", "/properties", "/location", "/gallery", "/offers"];
const checkoutPatterns = /(checkout|payment|pay|reserve|booking|book|payment-method|confirmation)/i;

const getHideUntil = () => {
  if (typeof localStorage === "undefined") return 0;
  const rawValue = localStorage.getItem(HIDE_KEY);
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(parsed)) {
    localStorage.removeItem(HIDE_KEY);
    return 0;
  }

  return parsed;
};

const setHideUntil = (timestamp: number) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(HIDE_KEY, String(timestamp));
};

const CallbackRequestBar = ({ hidden = false }: CallbackRequestBarProps) => {
  const location = useLocation();
  const matchPropertyDetails =
    matchPath("/property_details/:id", location.pathname) ?? matchPath("/properties/:id", location.pathname);
  const listingId = matchPropertyDetails?.params?.id;

  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isHiddenForModal, setIsHiddenForModal] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const isHome = location.pathname === "/";
  const isCheckoutPath = checkoutPatterns.test(location.pathname);
  const isListingContext =
    isHome || listingPrefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(prefix));
  const isEligible = isListingContext && !isCheckoutPath && !isDismissed && !hidden;

  const analyticsIdentifiers = useMemo(
    () => ({
      route: location.pathname,
      listingId,
      unitCode: listingId,
    }),
    [listingId, location.pathname],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsDismissed(getHideUntil() > Date.now());
  }, [location.key]);

  useEffect(() => {
    if (!isEligible) {
      setShouldRender(false);
      return undefined;
    }

    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      setShouldRender(true);
    };

    const timerId = window.setTimeout(activate, VIEW_DELAY_MS);
    const handleScroll = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      if (progress >= SCROLL_THRESHOLD) {
        activate();
        window.clearTimeout(timerId);
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isEligible, location.key]);

  useEffect(() => {
    if (!shouldRender) return undefined;

    const updateModalState = () => setIsHiddenForModal(hasVisibleModal());
    updateModalState();

    const observer = new MutationObserver(updateModalState);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    window.addEventListener("resize", updateModalState);
    window.addEventListener("scroll", updateModalState, true);
    window.addEventListener("keydown", updateModalState);
    window.addEventListener("visibilitychange", updateModalState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateModalState);
      window.removeEventListener("scroll", updateModalState, true);
      window.removeEventListener("keydown", updateModalState);
      window.removeEventListener("visibilitychange", updateModalState);
    };
  }, [shouldRender]);

  useEffect(() => {
    if (shouldRender && !hasTrackedView && !isHiddenForModal) {
      trackEvent("callback_bar_viewed", { surface: "callback_bar" }, analyticsIdentifiers);
      setHasTrackedView(true);
    }
  }, [analyticsIdentifiers, hasTrackedView, isHiddenForModal, shouldRender]);

  useEffect(() => {
    setStatus("idle");
    setMessage("");
    setHasTrackedView(false);
  }, [location.pathname]);

  const bottomOffset = isListingContext && !isHome ? 120 : 96;
  const bottomSpacing = `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${bottomOffset}px)`;
  const showBar = shouldRender && isEligible && !isHiddenForModal;
  const validationMessage = phone && !isValidIndiaPhone(phone) ? "Enter a valid 10-digit Indian mobile number." : "";

  const handleDismiss = () => {
    const hideUntil = Date.now() + HIDE_DURATION_MS;
    setHideUntil(hideUntil);
    setIsDismissed(true);
    setShouldRender(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidIndiaPhone(phone)) {
      setStatus("error");
      setMessage("Please enter a valid 10-digit Indian phone number.");
      return;
    }

    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    trackEvent("callback_submitted", { surface: "callback_bar" }, analyticsIdentifiers);

    try {
      const response = await submitCallbackLead({
        phone: `+91${phone}`,
        listingId,
        route: location.pathname,
        unitCode: listingId,
      });

      if (!response.ok) {
        throw response.error || new Error("Unable to submit request");
      }

      setStatus("success");
      setMessage("Thanks! Our team will call you back shortly.");
      setPhone("");
    } catch (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again in a moment.");
      trackEvent(
        "callback_submit_failed",
        { surface: "callback_bar", error: error instanceof Error ? error.message : "unknown_error" },
        analyticsIdentifiers,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showBar) return null;

  return (
    <div
      className="fixed inset-x-4 md:inset-x-auto md:right-6 md:left-auto z-[var(--z-sticky)]"
      style={{ bottom: bottomSpacing }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface px-4 py-4 shadow-level2 ring-1 ring-border-subtle md:px-6">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss callback request bar"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
        >
          <FiX aria-hidden="true" className="text-lg" />
        </button>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary md:text-base">
              <FiPhoneCall aria-hidden="true" className="text-base text-accent-primary md:text-lg" />
              <span>Need us to call you back?</span>
            </div>
            <p className="text-xs text-text-muted md:text-sm">
              Share your number and our team will help with availability, pricing, or booking details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-muted px-3 py-2 shadow-level1 transition focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
              <span className="text-sm font-semibold text-text-muted">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                value={phone}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "").slice(-10);
                  setPhone(digitsOnly);
                }}
                placeholder="10-digit phone number"
                className="w-40 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted md:w-44 md:text-base"
                aria-invalid={Boolean(validationMessage)}
                aria-describedby="callback-phone-help"
              />
            </div>

            <button
              type="submit"
              disabled={!isValidIndiaPhone(phone) || isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-[var(--cta-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 transition hover:bg-[var(--cta-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary disabled:cursor-not-allowed disabled:opacity-60 md:px-5 md:py-2.5 md:text-base"
            >
              {isSubmitting ? "Sending..." : "Get a Call Back"}
            </button>
          </form>
        </div>

        <div className="mt-2 min-h-[18px] text-xs text-text-muted md:text-sm" id="callback-phone-help" role="status">
          {status === "success" && <span className="text-success">{message}</span>}
          {status === "error" && <span className="text-danger">{message}</span>}
          {status === "idle" && validationMessage && <span className="text-danger">{validationMessage}</span>}
        </div>
      </div>
    </div>
  );
};

export default CallbackRequestBar;
