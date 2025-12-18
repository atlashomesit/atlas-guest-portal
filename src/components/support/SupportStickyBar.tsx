import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiPhone } from "react-icons/fi";
import { useLocation, useMatch } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { buildWaLink } from "../../utils/whatsapp";
import { trackEvent } from "../../utils/analytics";

const VISIBLE_MODAL_SELECTORS = [
  "dialog[open]",
  "[role='dialog']",
  "[aria-modal='true']",
  ".modal.show",
  ".modal[open]",
  ".fixed.inset-0",
  "[data-radix-portal]",
];

const hasVisibleModal = () => {
  if (typeof document === "undefined") return false;

  return VISIBLE_MODAL_SELECTORS.some((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;

    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      styles.display !== "none" &&
      styles.visibility !== "hidden" &&
      parseFloat(styles.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
};

const SupportStickyBar = () => {
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const isCheckoutContext = /checkout|reserve/i.test(location.pathname);
  const [pageUrl, setPageUrl] = useState("");
  const [isHiddenForModal, setIsHiddenForModal] = useState(false);

  const shouldShow = (matchPropertyDetails || isCheckoutContext) && !isHiddenForModal;

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
  const bottomSpacing = `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffset}px)`;

  return (
    <div
      className="fixed inset-x-4 md:inset-x-auto md:right-6 md:left-auto z-30"
      style={{ bottom: bottomSpacing }}
    >
      <div className="flex flex-col items-stretch gap-3 rounded-2xl bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5 md:flex-row md:items-center md:gap-4">
        <div className="text-center text-sm font-semibold text-gray-900 md:text-left md:text-base">
          Need help booking?
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:ml-auto md:flex-row">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent(
                "support_whatsapp",
                { surface: "sticky_bar" },
                { route: location.pathname, unitCode: matchPropertyDetails?.params?.id },
              )
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1DA851] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] sm:w-auto"
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:w-auto"
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
