import { useEffect, useMemo, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { CONTACT } from "../../config/contact";
import { trackEvent } from "../../utils/analytics";
import { buildWaLink, defaultPrefill } from "../../utils/whatsapp";
import CallbackRequestBar from "./CallbackRequestBar";
import ChatLauncherPill from "./chatbot/ChatLauncherPill";
import ChatWidget, { ChatMessage } from "./chatbot/ChatWidget";
import { escalationKeywords, matchIntent, quickActions } from "./chatbot/intents";
import { useChatWidgetState } from "./chatbot/useChatWidgetState";
import { submitCallbackRequest } from "./callbackService";
import SupportStickyBar from "./SupportStickyBar";

const HISTORY_KEY = "support-chat-history";

const defaultBotMessage: ChatMessage = {
  id: "bot-welcome",
  sender: "bot",
  text: "Hi there! I can help with check-in times, cancellation rules, parking, directions, and getting you to a human.",
  createdAt: Date.now(),
};

const loadMessages = (): ChatMessage[] => {
  if (typeof window === "undefined") return [defaultBotMessage];

  try {
    const cached = window.localStorage.getItem(HISTORY_KEY);
    if (!cached) return [defaultBotMessage];
    const parsed = JSON.parse(cached) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultBotMessage];
    return parsed;
  } catch (error) {
    console.warn("[chat] unable to read cached chat", error);
    return [defaultBotMessage];
  }
};

const persistMessages = (messages: ChatMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    const recent = messages.slice(-25);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(recent));
  } catch (error) {
    console.warn("[chat] failed to persist chat", error);
  }
};

const SupportLauncher = () => {
  const location = useLocation();
  const matchPropertyDetails =
    matchPath("/property_details/:id", location.pathname) ?? matchPath("/properties/:id", location.pathname);
  const unitCode = matchPropertyDetails?.params?.id ?? null;

  const isCheckoutContext = /checkout|reserve/i.test(location.pathname);
  const isPaymentStep = /payment|razorpay|pay/.test(location.pathname);
  const shouldSuppressChat = isPaymentStep;

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [pageUrl, setPageUrl] = useState("");
  const [isEscalationActive, setEscalationActive] = useState(false);
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackStatus, setCallbackStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const chatState = useChatWidgetState(shouldSuppressChat);
  const bottomSpacing = useMemo(() => {
    const base = isCheckoutContext ? "6.5rem" : "1.75rem";
    return `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${base})`;
  }, [isCheckoutContext]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  const whatsappLink = useMemo(
    () =>
      buildWaLink({
        phoneE164: CONTACT.business.whatsapp,
        text: defaultPrefill({ href: pageUrl, context: "booking or payments" }),
      }),
    [pageUrl],
  );

  const appendMessage = (message: Omit<ChatMessage, "id" | "createdAt"> & Partial<Pick<ChatMessage, "id" | "createdAt">>) => {
    const payload: ChatMessage = {
      id: message.id ?? `${message.sender}-${Date.now()}`,
      createdAt: message.createdAt ?? Date.now(),
      ...message,
    } as ChatMessage;

    setMessages((prev) => [...prev, payload]);
  };

  const handleOpen = () => {
    chatState.open();
    trackEvent(
      "chat_opened",
      { surface: "chat_widget", entryPoint: "launcher" },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );
  };

  const handleMinimize = () => {
    chatState.minimize();
    trackEvent(
      "chat_minimized",
      { surface: "chat_widget" },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );
  };

  const handleClose = () => {
    chatState.close();
  };

  const processMessage = (content: string, source: "input" | "quick_action") => {
    const normalized = content.toLowerCase();
    const intent = matchIntent(content, { unitCode, route: location.pathname });
    const mentionsCallback = normalized.includes("callback") || normalized.includes("call back");
    const shouldEscalate =
      escalationKeywords.some((keyword) => normalized.includes(keyword)) ||
      (source === "quick_action" && quickActions.find((action) => action.prompt === content)?.escalate);

    appendMessage({ sender: "user", text: content, intentId: intent?.id });

    trackEvent(
      "chat_message_sent",
      {
        surface: "chat_widget",
        messageType: source === "input" ? "text" : "quick_action",
        intent: intent?.id ?? "freeform",
        charCount: content.length,
      },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );

    if (intent) {
      appendMessage({ sender: "bot", text: intent.response, intentId: intent.id });
    } else {
      appendMessage({
        sender: "bot",
        text: "I can help with timings, cancellation, parking, IDs, or connect you to the team on WhatsApp/callback.",
      });
    }

    if (shouldEscalate) {
      setEscalationActive(true);
      trackEvent(
        "chat_escalated_whatsapp",
        { surface: "chat_widget", source },
        { route: location.pathname, unitCode: unitCode ?? undefined },
      );
    }

    if (mentionsCallback || content === quickActions.find((qa) => qa.id === "callback")?.prompt) {
      setShowCallbackForm(true);
      setCallbackStatus("idle");
      setCallbackError(null);
      trackEvent(
        "chat_callback_started",
        { surface: "chat_widget" },
        { route: location.pathname, unitCode: unitCode ?? undefined },
      );
    }
  };

  const handleQuickAction = (action: (typeof quickActions)[number]) => {
    processMessage(action.prompt, "quick_action");
  };

  const handleEscalateWhatsapp = () => {
    setEscalationActive(true);
    trackEvent(
      "chat_escalated_whatsapp",
      { surface: "chat_widget", source: "cta" },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );
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
        note: `Chat callback from ${pageUrl || location.pathname}`,
        route: location.pathname,
        unitCode,
        source: "chat_widget",
      });
      setCallbackStatus("sent");
      trackEvent(
        "chat_callback_submitted",
        { surface: "chat_widget" },
        { route: location.pathname, unitCode: unitCode ?? undefined },
      );
      setTimeout(() => setShowCallbackForm(false), 1200);
    } catch (error) {
      console.error("[chat] callback request failed", error);
      setCallbackStatus("error");
      setCallbackError("Could not send request. Try again or WhatsApp us.");
    }
  };

  if (shouldSuppressChat) return null;

  return (
    <>
      <ChatWidget
        chatState={chatState}
        messages={messages}
        quickActions={quickActions}
        onSend={processMessage}
        onQuickAction={handleQuickAction}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onEscalateWhatsapp={handleEscalateWhatsapp}
        bottomSpacing={bottomSpacing}
        whatsappLink={whatsappLink}
        showCallbackForm={showCallbackForm}
        callbackPhone={callbackPhone}
        callbackStatus={callbackStatus}
        callbackError={callbackError}
        onCallbackPhoneChange={setCallbackPhone}
        onCallbackSubmit={handleCallbackSubmit}
        isEscalationActive={isEscalationActive}
      />

      <ChatLauncherPill
        onOpen={handleOpen}
        chatState={chatState}
        hidden={chatState.isExpanded}
        bottomSpacing={bottomSpacing}
        route={location.pathname}
        unitCode={unitCode}
      />

      <CallbackRequestBar hidden={chatState.isExpanded} />
      <SupportStickyBar hidden={chatState.isExpanded} />
    </>
  );
};

export default SupportLauncher;
