import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPhoneAlt, FaQuestionCircle, FaWhatsapp } from "react-icons/fa";

import { CONTACT, getTelLink } from "../../config/contact";
import { buildWaLink, defaultPrefill } from "../../utils/whatsapp";
import { trackEvent } from "../../utils/analytics";

const PANEL_ID = "help-launcher-panel";

const HelpLauncher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pageUrl, setPageUrl] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : true
  );
  const [isOpen, setIsOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const className = "help-launcher-open";
    if (isMobile && isOpen) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }

    return () => {
      document.body.classList.remove(className);
    };
  }, [isMobile, isOpen]);

  const whatsappLink = useMemo(
    () =>
      buildWaLink({
        phoneE164: CONTACT.business.whatsapp,
        text: defaultPrefill({ href: pageUrl, context: "booking or payments" }),
      }),
    [pageUrl]
  );

  const handleFaqNavigation = () => {
    navigate("/faq");
    setIsOpen(false);
    trackEvent("support_faq", { surface: "help_launcher" }, { route: location.pathname });
  };

  const links = [
    {
      label: "Chat on WhatsApp",
      description: "Message us for quick support",
      href: whatsappLink,
      icon: <FaWhatsapp aria-hidden="true" />,
      external: true,
    },
    {
      label: "Call the team",
      description: "Speak with a specialist",
      href: getTelLink(),
      icon: <FaPhoneAlt aria-hidden="true" />,
      external: false,
    },
    {
      label: "Visit FAQs",
      description: "Find answers instantly",
      onClick: handleFaqNavigation,
      icon: <FaQuestionCircle aria-hidden="true" />,
      external: false,
    },
  ];

  return (
    <div
      className="help-launcher fixed"
      data-help-panel
      aria-live="polite"
      aria-label="Guest assistance shortcuts"
    >
      <div className="flex flex-col items-end gap-3">
        <div
          id={PANEL_ID}
          role="region"
          aria-label="Help quick links"
          aria-hidden={!isOpen}
          className={`w-64 overflow-hidden rounded-2xl bg-[color:color-mix(in_srgb,var(--bg-surface)_95%,transparent)] p-3 text-text-primary shadow-level2 ring-1 ring-border-subtle backdrop-blur transition-[opacity,transform] duration-200 ease-out sm:w-72 ${
            isOpen
              ? "pointer-events-auto opacity-100 focus-within:shadow-level2 focus-within:ring-border-strong"
              : "pointer-events-none opacity-0 translate-y-1"
          }`}
    >
          <ul className="flex flex-col gap-2 text-sm" data-help-links>
            {links.map((link) => (
              <li key={link.label}>
                {link.href ? (
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    onClick={() =>
                      trackEvent(
                        link.label.toLowerCase().includes("whatsapp") ? "support_whatsapp" : "support_call",
                        { surface: "help_launcher" },
                        { route: location.pathname },
                      )
                    }
                    className="group flex items-start gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-bg-muted focus-visible:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                  >
                    <span className="mt-0.5 text-lg text-accent-primary">{link.icon}</span>
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{link.label}</span>
                      <span className="text-xs text-text-muted">{link.description}</span>
                    </span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={link.onClick}
                    className="group flex w-full items-start gap-3 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-bg-muted focus-visible:bg-bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                  >
                    <span className="mt-0.5 text-lg text-accent-primary">{link.icon}</span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="font-semibold">{link.label}</span>
                      <span className="text-xs text-text-muted">{link.description}</span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="flex items-center gap-3 rounded-full bg-cta-primary px-4 py-3 text-[var(--text-contrast)] shadow-level2 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
          aria-expanded={isOpen}
          aria-controls={PANEL_ID}
          aria-label={isOpen ? "Hide help options" : "Show help options"}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--text-contrast)_20%,transparent)] text-lg">
            <FaQuestionCircle aria-hidden="true" />
          </span>
          <span className="flex flex-col text-left leading-tight">
            <span className="text-sm font-semibold">Need help?</span>
            <span className="text-[11px] text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">Chat, call, or browse FAQs</span>
          </span>
          <span className="text-sm" aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default HelpLauncher;
