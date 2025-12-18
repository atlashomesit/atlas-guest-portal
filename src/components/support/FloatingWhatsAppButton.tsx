import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";

import { CONTACT } from "../../config/contact";
import { buildWaLink } from "../../utils/whatsapp";

const getHelpPanelElement = () =>
  document.querySelector<HTMLElement>("[data-help-panel], .help-panel, #help-panel");

const buildPrefillMessage = (pageUrl: string, unitSlug?: string | null) => {
  const unitContext = unitSlug ? `I'm interested in unit ${unitSlug}.` : "I'd like to know more about your stays.";
  const urlText = pageUrl ? ` Page: ${pageUrl}` : "";

  return `Hi Atlas Homestays 👋 ${unitContext}${urlText}`.trim();
};

const FloatingWhatsAppButton = () => {
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const unitSlug = matchPropertyDetails?.params?.id || null;
  const [pageUrl, setPageUrl] = useState<string>("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  const whatsappLink = useMemo(() => {
    const prefill = buildPrefillMessage(pageUrl, unitSlug);
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefill });
  }, [pageUrl, unitSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateOverlap = () => {
      const helpPanel = getHelpPanelElement();
      const buttonEl = buttonRef.current;

      if (!helpPanel || !buttonEl) {
        setIsCollapsed(false);
        return;
      }

      const panelRect = helpPanel.getBoundingClientRect();
      const buttonRect = buttonEl.getBoundingClientRect();
      const isOverlapping =
        panelRect.left < buttonRect.right &&
        panelRect.right > buttonRect.left &&
        panelRect.top < buttonRect.bottom &&
        panelRect.bottom > buttonRect.top;

      setIsCollapsed(isOverlapping && window.innerWidth < 768);
    };

    updateOverlap();
    window.addEventListener("resize", updateOverlap);
    window.addEventListener("scroll", updateOverlap, true);

    const helpPanel = getHelpPanelElement();
    const observer =
      helpPanel &&
      new MutationObserver(updateOverlap);

    if (helpPanel && observer) {
      observer.observe(helpPanel, { attributes: true, childList: true, subtree: true });
    }

    return () => {
      window.removeEventListener("resize", updateOverlap);
      window.removeEventListener("scroll", updateOverlap, true);
      observer?.disconnect();
    };
  }, [location.pathname]);

  if (isCollapsed) {
    return null;
  }

  return (
    <div ref={buttonRef} className="floating-whatsapp fixed">
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center gap-3 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_-10px_rgba(37,211,102,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] sm:px-5 sm:py-3.5"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-2xl sm:h-11 sm:w-11">
          <FaWhatsapp aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold leading-tight sm:text-base">WhatsApp us</span>
          <span className="text-[11px] leading-tight text-white/90 sm:text-xs">Quickest way to reach the team</span>
        </span>
      </a>
    </div>
  );
};

export default FloatingWhatsAppButton;
