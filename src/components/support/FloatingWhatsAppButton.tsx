import { useEffect, useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { useLocation, useMatch } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { trackEvent } from "../../utils/analytics";
import { buildWaLink } from "../../utils/whatsapp";

const FloatingWhatsAppButton = () => {
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  const whatsappLink = useMemo(() => {
    const prefillText = `Hi Atlas Homestays 👋 I need help with my stay. Page: ${pageUrl || location.pathname}`;
    return buildWaLink({ phoneE164: CONTACT.business.whatsapp, text: prefillText });
  }, [location.pathname, pageUrl]);

  const isCheckoutContext = /payment|checkout|pay/i.test(location.pathname);
  if (isCheckoutContext) return null;

  const bottomSpacing = "calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 1.25rem)";

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noreferrer"
      onClick={() =>
        trackEvent(
          "support_whatsapp",
          { surface: "floating_whatsapp" },
          { route: location.pathname, unitCode: matchPropertyDetails?.params?.id },
        )
      }
      className="fixed left-4 z-[var(--z-floating)] inline-flex items-center gap-2 rounded-full bg-success px-4 py-3 text-sm font-semibold text-[var(--text-contrast)] shadow-level3 transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--support-success)_85%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success md:left-5"
      style={{ bottom: bottomSpacing }}
      aria-label="Chat on WhatsApp"
    >
      <FaWhatsapp aria-hidden="true" className="text-lg" />
      WhatsApp
    </a>
  );
};

export default FloatingWhatsAppButton;
