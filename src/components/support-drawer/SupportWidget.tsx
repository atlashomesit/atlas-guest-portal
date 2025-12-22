import { useEffect, useMemo, useState } from "react";
import { useLocation, useMatch } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { getFeatureFlags } from "../../config/featureFlags";
import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";
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
const DISMISS_KEY = "supportDrawer:dismissed";

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
  const {
    enableClickOutsideToClose,
    enableSupportCtaHierarchy,
    enableSupportLayoutVariants,
    enableChatbotPlaceholder,
    enableHideUnfinishedChatbot,
    enableRevealCallbackOnClickOnly,
    enableRecommendedWhatsAppPrimary,
    enableCloseReassurance,
    enableSessionDismissRemember,
    enableTrustMicrocopy,
  } = useSupportDrawerFlags();
  const [isDismissed, setIsDismissed] = useState(false);
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
    if (!enableSessionDismissRemember || typeof window === "undefined") return;
    setIsDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
  }, [enableSessionDismissRemember]);

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

  const rememberDismissal = () => {
    if (!enableSessionDismissRemember || typeof window === "undefined") return;
    sessionStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  };

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent("chat_opened", { surface: "support_widget", entryPoint: "floating_pill" }, analyticsMetadata);
  };

  const handleClose = () => {
    setIsOpen(false);
    rememberDismissal();
    trackEvent("chat_minimized", { surface: "support_widget" }, analyticsMetadata);
  };

  const handlePhoneChange = (value: string) => {
    setCallbackPhone(value.replace(/\D/g, "").slice(-10));
  };

  const handleCallbackSubmit = async () => {
    setCallbackError(null);
    const sanitized = callbackPhone.replace(/\D/g, "");
    if (sanitized.length !== 10) {
      setCallbackError(SUPPORT_DRAWER_COPY.callbackForm.invalidPhoneError);
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
      setCallbackError(SUPPORT_DRAWER_COPY.callbackForm.submissionError);
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
          enableCtaHierarchy={enableSupportCtaHierarchy}
          enableRecommendedWhatsAppPrimary={enableRecommendedWhatsAppPrimary}
          onCallClick={() => trackEvent("support_call", { surface: "support_widget" }, analyticsMetadata)}
          onFaqClick={handleFaqClick}
          onCallbackClick={enableRevealCallbackOnClickOnly ? handleCallbackCardClick : undefined}
          onWhatsappClick={handleWhatsappClick}
          whatsappLink={whatsappLink}
        />

        <div className="flex flex-col gap-[var(--drawer-section-gap)] px-[var(--drawer-card-padding-inline)] pb-[calc(var(--drawer-card-padding-block)_+_0.25rem)]">
          {isCallbackExpanded ? (
            <CallbackRequestForm
              callbackError={callbackError}
              callbackPhone={callbackPhone}
              callbackStatus={callbackStatus}
              expectationText={SUPPORT_DRAWER_COPY.callbackForm.expectationText}
              onClose={handleClose}
              onPhoneChange={handlePhoneChange}
              onSubmit={handleCallbackSubmit}
            />
          ) : null}

          {enableChatbotPlaceholder ? (
            <ChatbotPlaceholder enableHideUnfinishedChatbot={enableHideUnfinishedChatbot} />
          ) : null}
        </div>
      </>
    );
  };

  if (location.pathname.includes("payment") || location.pathname.includes("checkout")) {
    return null;
  }

  if (enableSessionDismissRemember && isDismissed) {
    return null;
  }

  return (
    <>
      {!isOpen ? <SupportWidgetTrigger bottomSpacing={bottomSpacing} onOpen={handleOpen} /> : null}

      {isOpen ? (
        <>
          {enableClickOutsideToClose ? (
            <div
              role="presentation"
              className="fixed inset-0 bg-transparent"
              style={{ zIndex: "calc(var(--z-floating) - 1)" }}
              onClick={handleClose}
            />
          ) : null}
          {/* Enable layoutVariants + ctaHierarchy (e.g., ?ff=layoutVariants,compactDrawer,ctaHierarchy)
              to trial the compact drawer and CTA priority without changing the default experience. */}
          <SupportDrawer
            bottomSpacing={bottomSpacing}
            layoutVariant={
              enableSupportLayoutVariants
                ? enableCompactDrawer
                  ? "compactDrawer"
                  : "fullHeightDrawer"
                : "legacy"
            }
            onClose={handleClose}
            enableCloseReassurance={enableCloseReassurance}
            trustMicrocopy={enableTrustMicrocopy ? SUPPORT_DRAWER_COPY.trustMicrocopy : undefined}
          >
            <DrawerContent />
          </SupportDrawer>
        </>
      ) : null}
    </>
  );
};

const SupportWidget = () => {
  const location = useLocation();
  const featureFlags = useMemo(() => getFeatureFlags(), [location.search]);

  return (
    <SupportDrawerFlagsProvider flags={featureFlags}>
      <SupportWidgetContent />
    </SupportDrawerFlagsProvider>
  );
};

export default SupportWidget;
