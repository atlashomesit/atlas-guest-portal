import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { FiBookOpen, FiMessageCircle, FiSend, FiX } from "react-icons/fi";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { CONTACT, getTelLink } from "../../config/contact";
import { trackEvent } from "../../utils/analytics";
import { buildWaLink, defaultPrefill } from "../../utils/whatsapp";
import CallbackRequestBar from "./CallbackRequestBar";
import { escalationKeywords, matchIntent, quickActions } from "./chatbot/intents";

const STORAGE_KEY = "support-chat-history";
const PANEL_ID = "support-launcher-panel";

type Sender = "user" | "bot";

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: number;
  intentId?: string;
}

const defaultBotMessage: ChatMessage = {
  id: "bot-welcome",
  sender: "bot",
  text: "Hi there! Ask me about check-in rules, amenities, refunds, or anything else about your stay.",
  createdAt: Date.now(),
};

const loadMessages = (): ChatMessage[] => {
  if (typeof window === "undefined") return [defaultBotMessage];

  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (!cached) return [defaultBotMessage];

    const parsed = JSON.parse(cached) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultBotMessage];

    return parsed;
  } catch (error) {
    console.warn("[support] unable to read cached chat", error);
    return [defaultBotMessage];
  }
};

const persistMessages = (messages: ChatMessage[]) => {
  if (typeof window === "undefined") return;
  try {
    const recent = messages.slice(-15);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch (error) {
    console.warn("[support] failed to persist chat", error);
  }
};

const SupportLauncher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const matchPropertyDetails = useMatch("/property_details/:id");
  const unitCode = matchPropertyDetails?.params?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [escalationActive, setEscalationActive] = useState(false);
  const [showCallbackBar, setShowCallbackBar] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const isCheckoutContext = /checkout|reserve/i.test(location.pathname);
  const bottomOffset = isCheckoutContext ? "6.5rem" : "1.75rem";
  const bottomSpacing = `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${bottomOffset})`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPageUrl(window.location.href);
  }, [location.key]);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea",
      "input",
      "select",
      "[tabindex]:not([tabindex='-1'])",
    ];

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(focusableSelectors.join(","));
    const first = focusables?.[0];
    const last = focusables?.[focusables.length - 1];

    lastFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab" && focusables && focusables.length > 0) {
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown as unknown as EventListener);
    return () => document.removeEventListener("keydown", handleKeyDown as unknown as EventListener);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, isOpen]);

  const whatsappLink = useMemo(
    () =>
      buildWaLink({
        phoneE164: CONTACT.business.whatsapp,
        text: defaultPrefill({ href: pageUrl, context: "booking or payments" }),
      }),
    [pageUrl],
  );

  const recordOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        trackEvent(
          "chat_opened",
          { surface: "support_launcher" },
          { route: location.pathname, unitCode: unitCode ?? undefined },
        );
      } else if (lastFocusRef.current) {
        lastFocusRef.current.focus();
        lastFocusRef.current = null;
      }
      return next;
    });
  };

  const appendMessage = (message: Omit<ChatMessage, "id" | "createdAt"> & Partial<Pick<ChatMessage, "id" | "createdAt">>) => {
    const payload: ChatMessage = {
      id: message.id ?? `${message.sender}-${Date.now()}`,
      createdAt: message.createdAt ?? Date.now(),
      ...message,
    } as ChatMessage;

    setMessages((prev) => [...prev, payload]);
  };

  const handleFaqNavigation = () => {
    navigate("/faq");
    setIsOpen(false);
    trackEvent("support_faq", { surface: "support_launcher" }, { route: location.pathname });
  };

  const handleSend = (event?: FormEvent) => {
    if (event) event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    processMessage(trimmed, "input");
    setInputValue("");
  };

  const processMessage = (content: string, source: "input" | "quick_action") => {
    const normalized = content.toLowerCase();
    const intent = matchIntent(content, { unitCode, route: location.pathname });
    const wordCount = content.trim().split(/\s+/).length;
    const mentionsCallback = normalized.includes("callback");

    appendMessage({ sender: "user", text: content, intentId: intent?.id });

    const shouldEscalate =
      escalationKeywords.some((keyword) => normalized.includes(keyword)) ||
      (source === "quick_action" && quickActions.find((action) => action.prompt === content)?.escalate);

    trackEvent(
      "chat_message_sent",
      { source, intent: intent?.id ?? "freeform", wordCount },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );

    if (intent) {
      appendMessage({ sender: "bot", text: intent.response, intentId: intent.id });
    } else {
      appendMessage({
        sender: "bot",
        text: "I can help with check-in times, cancellations, amenities, or connecting you to a human. Want me to route you to WhatsApp or arrange a callback?",
      });
    }

    if (shouldEscalate) {
      setEscalationActive(true);
      if (mentionsCallback) {
        setShowCallbackBar(true);
      }
      trackEvent(
        "chat_escalated_whatsapp",
        { surface: "support_launcher", source },
        { route: location.pathname, unitCode: unitCode ?? undefined },
      );
    }
  };

  const handleQuickAction = (prompt: string, id: string, escalate?: boolean) => {
    processMessage(prompt, "quick_action");
    trackEvent(
      "chat_quick_action_clicked",
      { id, label: prompt, surface: "support_launcher" },
      { route: location.pathname, unitCode: unitCode ?? undefined },
    );

    if (escalate) {
      setEscalationActive(true);
      if (id === "callback") {
        setShowCallbackBar(true);
      }
    }
  };

  const handleTextareaKeydown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const contactButtons = [
    {
      label: "WhatsApp",
      description: "Fastest response",
      href: whatsappLink,
      icon: <FaWhatsapp aria-hidden="true" />, // event track onClick
      onClick: () =>
        trackEvent(
          "support_whatsapp",
          { surface: "support_launcher" },
          { route: location.pathname, unitCode: unitCode ?? undefined },
        ),
    },
    {
      label: "Call",
      description: "Speak with the team",
      href: getTelLink(),
      icon: <FaPhoneAlt aria-hidden="true" />,
      onClick: () =>
        trackEvent(
          "support_call",
          { surface: "support_launcher" },
          { route: location.pathname, unitCode: unitCode ?? undefined },
        ),
    },
    {
      label: "FAQs",
      description: "Instant answers",
      onClick: handleFaqNavigation,
      icon: <FiBookOpen aria-hidden="true" />,
    },
    {
      label: "Request callback",
      description: "We&apos;ll ring you",
      onClick: () => {
        setShowCallbackBar(true);
        setEscalationActive(true);
        trackEvent(
          "chat_callback_cta_clicked",
          { surface: "support_launcher" },
          { route: location.pathname, unitCode: unitCode ?? undefined },
        );
      },
      icon: <FiMessageCircle aria-hidden="true" />,
    },
  ];

  return (
    <>
      <CallbackRequestBar
        open={showCallbackBar}
        onClose={() => setShowCallbackBar(false)}
        route={location.pathname}
        unitCode={unitCode}
        source="support_launcher"
      />
      <div
        className="support-launcher fixed"
        style={{ right: "1rem", bottom: bottomSpacing }}
        aria-live="polite"
      >
        <div className="flex flex-col items-end gap-3">
          <div
            id={PANEL_ID}
            ref={panelRef}
            role="dialog"
            aria-label="Support chat and shortcuts"
            aria-modal={isOpen}
            aria-hidden={!isOpen}
            className={`w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_94%,#f7f4ed_8%)] text-text-primary shadow-level3 ring-1 ring-border-subtle backdrop-blur transition-[opacity,transform] duration-200 ease-out ${
              isOpen ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
            }`}
          >
            <div className="flex items-start justify-between gap-3 bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f2efe8_18%)] px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-text-primary">Need a hand?</p>
                <p className="text-xs text-text-muted">Chat with Atlas or jump to WhatsApp/callback without losing your place.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
                aria-label="Close support panel"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-2" aria-label="Support shortcuts">
                {contactButtons.map((action) => (
                  action.href ? (
                    <a
                      key={action.label}
                      href={action.href}
                      target={action.label === "WhatsApp" ? "_blank" : undefined}
                      rel={action.label === "WhatsApp" ? "noreferrer" : undefined}
                      onClick={action.onClick}
                      className="group flex items-start gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--bg-surface)_92%,#f4efe7_10%)] px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                    >
                      <span className="mt-0.5 text-base text-accent-primary">{action.icon}</span>
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold">{action.label}</span>
                        <span className="text-[11px] text-text-muted" dangerouslySetInnerHTML={{ __html: action.description }} />
                      </span>
                    </a>
                  ) : (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="group flex w-full items-start gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--bg-surface)_92%,#f4efe7_10%)] px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                    >
                      <span className="mt-0.5 text-base text-accent-primary">{action.icon}</span>
                      <span className="flex flex-col leading-tight">
                        <span className="font-semibold">{action.label}</span>
                        <span className="text-[11px] text-text-muted" dangerouslySetInnerHTML={{ __html: action.description }} />
                      </span>
                    </button>
                  )
                ))}
              </div>

              {escalationActive ? (
                <div className="flex items-start gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--cta-secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--cta-secondary)_16%,transparent)] px-3 py-2 text-xs text-text-primary">
                  <FiMessageCircle aria-hidden="true" className="mt-0.5 text-cta-secondary" />
                  <span>
                    Prefer a human? Use the WhatsApp or callback options above. I will keep this chat running in case you want quick links while you wait.
                  </span>
                </div>
              ) : null}

              <div
                ref={messageListRef}
                className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-3"
                aria-live="polite"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-level1 ${
                        message.sender === "user"
                          ? "bg-cta-primary text-[var(--text-contrast)]"
                          : "bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f3efe8_15%)] text-text-primary border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)]"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2" aria-label="Chat quick actions">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action.prompt, action.id, action.escalate)}
                    className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              <form className="flex items-end gap-2" onSubmit={handleSend}>
                <div className="flex-1 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 shadow-inner focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent-primary">
                  <label htmlFor="support-message" className="sr-only">
                    Message support
                  </label>
                  <textarea
                    id="support-message"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleTextareaKeydown}
                    rows={2}
                    className="h-16 w-full resize-none bg-transparent text-sm text-text-primary outline-none"
                    placeholder="Ask about check-in, cancellation, parking, Wi-Fi, or share how we can help"
                  />
                </div>
                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-cta-primary text-[var(--text-contrast)] shadow-level2 transition hover:-translate-y-0.5 hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                  aria-label="Send message"
                >
                  <FiSend aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>

          <button
            ref={triggerRef}
            type="button"
            className="flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_90%,#f7f4ed_12%)] px-4 py-3 text-[var(--text-contrast)] shadow-level3 ring-1 ring-[color-mix(in_srgb,var(--cta-primary)_45%,transparent)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
            aria-expanded={isOpen}
            aria-controls={PANEL_ID}
            aria-label={isOpen ? "Hide support options" : "Show support options"}
            onClick={recordOpen}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--text-contrast)_18%,transparent)] text-lg">
              <FiMessageCircle aria-hidden="true" />
            </span>
            <span className="flex flex-col text-left leading-tight">
              <span className="text-sm font-semibold">Need help?</span>
              <span className="text-[11px] text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">Chat, WhatsApp, or request a callback</span>
            </span>
            <span className="text-sm" aria-hidden="true">
              {isOpen ? "−" : "+"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SupportLauncher;
