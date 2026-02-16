import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { FiExternalLink, FiMinus, FiSend, FiX } from "react-icons/fi";

import { QuickAction } from "./intents";
import { UseChatWidgetStateReturn } from "./useChatWidgetState";

export type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
  createdAt: number;
  intentId?: string;
};

interface ChatWidgetProps {
  chatState: UseChatWidgetStateReturn;
  messages: ChatMessage[];
  quickActions: QuickAction[];
  onSend: (message: string, source: "input" | "quick_action") => void;
  onQuickAction: (action: QuickAction) => void;
  onClose: () => void;
  onMinimize: () => void;
  onEscalateWhatsapp: () => void;
  bottomSpacing: string;
  whatsappLink: string;
  showCallbackForm: boolean;
  callbackPhone: string;
  callbackStatus: "idle" | "sending" | "sent" | "error";
  callbackError: string | null;
  onCallbackPhoneChange: (value: string) => void;
  onCallbackSubmit: () => Promise<void> | void;
  isEscalationActive: boolean;
}

const callbackPlaceholder = "10-digit phone number";

const ChatWidget = ({
  chatState,
  messages,
  quickActions,
  onSend,
  onQuickAction,
  onClose,
  onMinimize,
  onEscalateWhatsapp,
  bottomSpacing,
  whatsappLink,
  showCallbackForm,
  callbackPhone,
  callbackStatus,
  callbackError,
  onCallbackPhoneChange,
  onCallbackSubmit,
  isEscalationActive,
}: ChatWidgetProps) => {
  const [draft, setDraft] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isVisible = chatState.isExpanded;

  useEffect(() => {
    if (!isVisible) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "textarea",
      "input",
      "select",
      "[tabindex]:not([tabindex='-1'])",
    ];
    const focusables = panel.querySelectorAll<HTMLElement>(focusableSelectors.join(","));
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onMinimize();
      }

      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown as unknown as EventListener);
    return () => document.removeEventListener("keydown", handleKeyDown as unknown as EventListener);
  }, [isVisible, onMinimize]);

  useEffect(() => {
    if (!isVisible) return;
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [isVisible, messages]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed, "input");
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onMinimize();
    }
  };

  const callbackLabel = useMemo(() => {
    if (callbackStatus === "sending") return "Sending...";
    if (callbackStatus === "sent") return "Request sent";
    return "Submit";
  }, [callbackStatus]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Atlas support chat"
      aria-modal="true"
      className="fixed right-3 z-[var(--z-floating)] w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_97%,#f7f4ed_8%)] text-text-primary shadow-level4 ring-1 ring-border-subtle backdrop-blur md:right-5"
      style={{ bottom: bottomSpacing }}
    >
      <div className="flex items-start justify-between gap-3 bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f2efe8_18%)] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-text-primary">Atlas Support</p>
          <p className="text-xs text-text-muted">FAQs, booking help, and WhatsApp handoff.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-full p-2 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
            aria-label="Minimize chat"
          >
            <FiMinus aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
            aria-label="Close chat"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-2" aria-label="Chat quick actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onQuickAction(action)}
              className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary shadow-level1 transition hover:-translate-y-0.5 hover:border-accent-primary hover:bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--cta-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--cta-primary)_10%,transparent)] px-3 py-2 text-xs text-text-primary shadow-level1">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_14%,transparent)] font-semibold text-accent-primary">
            <FiExternalLink aria-hidden="true" className="text-base" />
          </span>
          <span>
            Prefer WhatsApp? We&apos;ll open a chat with the team. This window stays here if you need quick links while you wait.
          </span>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center justify-center rounded-full bg-success px-3 py-2 text-xs font-semibold text-[var(--text-contrast)] transition hover:bg-[color-mix(in_srgb,var(--support-success)_85%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
            onClick={onEscalateWhatsapp}
          >
            WhatsApp us
          </a>
        </div>

        {isEscalationActive ? (
          <div className="flex items-start gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--cta-secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--cta-secondary)_16%,transparent)] px-3 py-2 text-xs text-text-primary">
            <span className="mt-0.5 text-cta-secondary">⚡</span>
            <span>
              I&apos;ll keep routing you to a human via WhatsApp or callback. You can still ask FAQs here while you wait.
            </span>
          </div>
        ) : null}

        <div
          ref={listRef}
          className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-3"
          aria-live="polite"
        >
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
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

        {showCallbackForm ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-bg-surface p-3 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-text-primary">Request a callback</p>
                <p className="text-xs text-text-muted">Share your number and we&apos;ll ring you shortly.</p>
              </div>
              <span className="rounded-full bg-bg-muted px-2 py-1 text-[11px] font-semibold text-text-muted">Human assist</span>
            </div>
            <form className="flex flex-col gap-2" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onCallbackSubmit(); }}>
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-muted px-3 py-2 shadow-inner focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20">
                <span className="text-xs font-semibold text-text-muted">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={callbackPhone}
                  onChange={(event) => onCallbackPhoneChange(event.target.value.replace(/\D/g, "").slice(-10))}
                  className="w-full bg-transparent text-sm font-medium text-text-primary outline-none placeholder:text-text-muted"
                  placeholder={callbackPlaceholder}
                />
              </div>
              {callbackError ? <p className="text-xs font-semibold text-support-error">{callbackError}</p> : null}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={callbackStatus === "sending"}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-cta-primary px-4 py-2 text-sm font-semibold text-[var(--text-contrast)] shadow-level1 transition hover:bg-cta-secondary disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
                >
                  {callbackLabel}
                </button>
                <button
                  type="button"
                  onClick={onMinimize}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-text-muted underline underline-offset-2"
                >
                  Later
                </button>
              </div>
              {callbackStatus === "sent" ? (
                <p className="text-xs font-semibold text-success">Got it! Our team will call you soon.</p>
              ) : null}
            </form>
          </div>
        ) : null}

        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="flex-1 rounded-2xl border border-border-subtle bg-bg-surface px-3 py-2 shadow-inner focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent-primary">
            <label htmlFor="chat-message" className="sr-only">
              Message Atlas support
            </label>
            <textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="h-16 w-full resize-none bg-transparent text-sm text-text-primary outline-none"
              placeholder="Ask about check-in, cancellation, parking, Wi-Fi, or anything else"
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
  );
};

export default ChatWidget;
