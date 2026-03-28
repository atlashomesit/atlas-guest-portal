import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiPhone } from "react-icons/fi";
import { matchPath, useLocation } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { trackEvent } from "../../utils/analytics";
import { hasVisibleModal } from "../../utils/modals";
import { buildWaLink } from "../../utils/whatsapp";

interface SupportStickyBarProps {
  hidden?: boolean;
}

const SupportStickyBar = ({ hidden = false }: SupportStickyBarProps) => {
  const location = useLocation();
  const matchPropertyDetails =
    matchPath("/property_details/:id", location.pathname) ?? matchPath("/properties/:id", location.pathname);
  const isCheckoutContext = /checkout|reserve/i.test(location.pathname);
  const [pageUrl, setPageUrl] = useState("");
  const [isHiddenForModal, setIsHiddenForModal] = useState(false);

  const shouldShow = (matchPropertyDetails || isCheckoutContext) && !isHiddenForModal && !hidden;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

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
  }, [location.pathname]);

  const whatsappLink = useMemo(() => {
    const prefillText = `Hi Atlas Homestays 👋 I need assistance with my booking. Page: ${pageUrl}`.trim();
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefillText });
  }, [pageUrl]);

  if (!shouldShow) return null;

  const hasMobileCheckoutElements = Boolean(matchPropertyDetails || isCheckoutContext);
  const bottomOffset = hasMobileCheckoutElements ? 96 : 20;
  const bottomSpacing = `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${bottomOffset}px)`;

  return (
    <div
      className="fixed inset-x-4 md:inset-x-auto md:right-6 md:left-auto z-[var(--z-sticky)]"
      style={{ bottom: bottomSpacing }}
    >
      <div className="flex flex-col items-stretch gap-3 rounded-2xl bg-bg-surface px-4 py-3 shadow-level2 ring-1 ring-border-subtle md:flex-row md:items-center md:gap-4">
        <div className="text-center text-sm font-semibold text-text-primary md:text-left md:text-base">
          Need help booking?
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:ml-auto md:flex-row">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent(
                "support_whatsapp",
                { surface: "sticky_bar" },
                { route: location.pathname, unitCode: matchPropertyDetails?.params?.id },
              )
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] transition hover:bg-[color-mix(in_srgb,var(--support-success)_85%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success shadow-level1 sm:w-auto"
          >
            <FaWhatsapp aria-hidden="true" className="text-lg" />
            WhatsApp
          </a>
          <a
            href={`tel:+91${CONTACT.business.phone}`}
            onClick={() =>
              trackEvent(
                "support_call",
                { surface: "sticky_bar" },
                { route: location.pathname, unitCode: matchPropertyDetails?.params?.id },
              )
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-level1 transition hover:border-border-strong hover:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong sm:w-auto"
          >
            <FiPhone aria-hidden="true" className="text-lg" />
            Call us
          </a>
        </div>
      </div>
    </div>
  );
};

export default SupportStickyBar;
