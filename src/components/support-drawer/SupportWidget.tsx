import { useEffect, useMemo, useState } from "react";
import { useLocation, useMatch } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { supportDrawerFlags } from "../../config/supportDrawerFlags";
import { trackEvent } from "../../utils/analytics";
import { buildWaLink, defaultPrefill } from "../../utils/whatsapp";
import { submitCallbackRequest } from "../support/callbackService";
import CallbackRequestForm from "./CallbackRequestForm";
import ChatbotPlaceholder from "./ChatbotPlaceholder";
import SupportActionGrid from "./SupportActionGrid";
import { SupportDrawerFlagsProvider, useSupportDrawerFlags } from "./SupportDrawerFlagsContext";
import SupportDrawer, { useSupportDrawerView } from "./SupportDrawer";
import SupportWidgetTrigger from "./SupportWidgetTrigger";
import { CallbackStatus, SupportAnalyticsMetadata } from "./supportDrawer.types";

const SCROLL_BUFFER_PX = 200;

const SupportWidgetContent = () => {
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const listingId = matchPropertyDetails?.params?.id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [footerOffset, setFooterOffset] = useState(0);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>("idle");
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const { enableHideUnfinishedChatbot, enableRevealCallbackOnClickOnly, enableRecommendedWhatsAppPrimary } =
    useSupportDrawerFlags();
  const [isCallbackExpanded, setIsCallbackExpanded] = useState(() => !enableRevealCallbackOnClickOnly);

  const analyticsMetadata: SupportAnalyticsMetadata = {
    route: location.pathname,
    listingId: listingId ?? undefined,
  };

  const bottomSpacing = useMemo(() => {
    const base = 20;
    return `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${base + footerOffset}px)`;
  }, [footerOffset]);

  const whatsappLink = useMemo(
    () =>
      buildWaLink({
        phoneE164: CONTACT.business.whatsapp,
        text: defaultPrefill({ href: pageUrl, context: "booking or payments" }),
      }),
    [pageUrl],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateOffset = () => {
      const doc = document.documentElement;
      const scrollBottom = window.scrollY + window.innerHeight;
      const distanceToBottom = doc.scrollHeight - scrollBottom;
      setFooterOffset(distanceToBottom < SCROLL_BUFFER_PX ? 72 : 0);
    };

    updateOffset();
    window.addEventListener("scroll", updateOffset, { passive: true });
    window.addEventListener("resize", updateOffset);
    return () => {
      window.removeEventListener("scroll", updateOffset);
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsCallbackExpanded(!enableRevealCallbackOnClickOnly);
    }
  }, [enableRevealCallbackOnClickOnly, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent("chat_opened", { surface: "support_widget", entryPoint: "floating_pill" }, analyticsMetadata);
  };

  const handleClose = () => {
    setIsOpen(false);
    trackEvent("chat_minimized", { surface: "support_widget" }, analyticsMetadata);
  };

  const handlePhoneChange = (value: string) => {
    setCallbackPhone(value.replace(/\D/g, "").slice(-10));
  };

  const handleCallbackSubmit = async () => {
    setCallbackError(null);
    const sanitized = callbackPhone.replace(/\D/g, "");
    if (sanitized.length !== 10) {
      setCallbackError("Enter a valid 10-digit number.");
      setCallbackStatus("error");
      return;
    }

    try {
      setCallbackStatus("sending");
      await submitCallbackRequest({
        phone: `+91${sanitized}`,
        note: `Support widget callback from ${pageUrl || location.pathname}`,
        route: location.pathname,
        unitCode: listingId ?? undefined,
        source: "support_widget",
      });
      setCallbackStatus("sent");
      trackEvent("chat_callback_submitted", { surface: "support_widget" }, analyticsMetadata);
      setTimeout(() => setIsOpen(false), 1200);
    } catch (error) {
      console.error("[support-widget] callback request failed", error);
      setCallbackStatus("error");
      setCallbackError("Could not send request. Try WhatsApp or call us.");
    }
  };

  const handleRevealCallback = () => {
    setIsCallbackExpanded(true);
  };

  const DrawerContent = () => {
    const { view, goToCallback, goToFaq, goToChat } = useSupportDrawerView();

    useEffect(() => {
      if (!enableRevealCallbackOnClickOnly) return;
      if (view === "callback") {
        setIsCallbackExpanded(true);
      }
    }, [enableRevealCallbackOnClickOnly, view]);

    const handleCallbackCardClick = () => {
      if (enableRevealCallbackOnClickOnly) {
        goToCallback();
        handleRevealCallback();
        return;
      }

      handleRevealCallback();
    };

    const handleFaqClick = () => {
      trackEvent("support_faq", { surface: "support_widget" }, analyticsMetadata);
      if (enableRevealCallbackOnClickOnly) {
        goToFaq();
      }
    };

    const handleWhatsappClick = () => {
      trackEvent("support_whatsapp", { surface: "support_widget" }, analyticsMetadata);
      if (enableRevealCallbackOnClickOnly) {
        goToChat();
      }
    };

    return (
      <>
        <SupportActionGrid
          contactPhone={CONTACT.business.phone}
          enableRecommendedWhatsAppPrimary={enableRecommendedWhatsAppPrimary}
          onCallClick={() => trackEvent("support_call", { surface: "support_widget" }, analyticsMetadata)}
          onFaqClick={handleFaqClick}
          onCallbackClick={enableRevealCallbackOnClickOnly ? handleCallbackCardClick : undefined}
          onWhatsappClick={handleWhatsappClick}
          whatsappLink={whatsappLink}
        />

        <div className="flex flex-col gap-3 px-4 pb-4">
          {isCallbackExpanded ? (
            <CallbackRequestForm
              callbackError={callbackError}
              callbackPhone={callbackPhone}
              callbackStatus={callbackStatus}
              onClose={handleClose}
              onPhoneChange={handlePhoneChange}
              onSubmit={handleCallbackSubmit}
            />
          ) : null}

          {enableHideUnfinishedChatbot ? null : <ChatbotPlaceholder />}
        </div>
      </>
    );
  };

  if (location.pathname.includes("payment") || location.pathname.includes("checkout")) {
    return null;
  }

  return (
    <>
      {!isOpen ? <SupportWidgetTrigger bottomSpacing={bottomSpacing} onOpen={handleOpen} /> : null}

      {isOpen ? (
        <SupportDrawer bottomSpacing={bottomSpacing} onClose={handleClose}>
          <DrawerContent />
        </SupportDrawer>
      ) : null}
    </>
  );
};

const SupportWidget = () => (
  <SupportDrawerFlagsProvider flags={supportDrawerFlags}>
    <SupportWidgetContent />
  </SupportDrawerFlagsProvider>
);

export default SupportWidget;
