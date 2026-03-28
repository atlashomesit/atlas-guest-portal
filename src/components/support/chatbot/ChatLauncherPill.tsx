import { useEffect } from "react";
import { FiMessageCircle } from "react-icons/fi";

import { trackEvent } from "../../../utils/analytics";
import { UseChatWidgetStateReturn } from "./useChatWidgetState";

interface ChatLauncherPillProps {
  onOpen: () => void;
  chatState: UseChatWidgetStateReturn;
  hidden?: boolean;
  bottomSpacing: string;
  route: string;
  unitCode?: string | null;
}

const ChatLauncherPill = ({ onOpen, chatState, hidden = false, bottomSpacing, route, unitCode }: ChatLauncherPillProps) => {
  useEffect(() => {
    if (hidden) return;
    trackEvent("chat_pill_viewed", { surface: "chat_widget" }, { route, unitCode: unitCode ?? undefined });
  }, [hidden, route, unitCode]);

  if (hidden || chatState.isExpanded) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed right-4 z-[var(--z-floating)] inline-flex items-center gap-3 rounded-full border border-[color-mix(in_srgb,var(--border-subtle)_85%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f3f0ea_10%)] px-4 py-3 text-sm font-semibold text-text-primary shadow-level3 ring-1 ring-border-subtle transition hover:-translate-y-0.5 hover:shadow-level4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary md:right-5"
      style={{ bottom: bottomSpacing }}
      aria-label="Chat with us"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-lg text-accent-primary">
        <FiMessageCircle aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className="text-sm font-semibold">Chat with us</span>
        <span className="text-[11px] text-text-muted">Instant answers, FAQs, WhatsApp</span>
      </span>
    </button>
  );
};

export default ChatLauncherPill;
