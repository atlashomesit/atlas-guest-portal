import { useState } from 'react';
import { FiMessageCircle } from "react-icons/fi";
import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";
import AtlasChat from './AtlasChat';

type ChatbotPlaceholderProps = {
  enableHideUnfinishedChatbot?: boolean;
  listingId?: string | null;
};

const ChatbotPlaceholder = ({
  enableHideUnfinishedChatbot = false,
  listingId = null,
}: ChatbotPlaceholderProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsChatOpen(prev => !prev);
  };

  const closeChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsChatOpen(false);
  };

  if (enableHideUnfinishedChatbot) {
    return (
      <>
        <div 
          className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-[var(--drawer-card-padding-block,0.75rem)] shadow-inner cursor-pointer hover:opacity-90 transition-opacity"
          onClick={toggleChat}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleChat()}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
              <FiMessageCircle aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{SUPPORT_DRAWER_COPY.chatbot.hidden.title}</p>
              <p className="text-[11px] text-text-muted">{SUPPORT_DRAWER_COPY.chatbot.hidden.description}</p>
            </div>
          </div>
        </div>
        {isChatOpen && <AtlasChat listingId={listingId} onClose={closeChat} />}
    </>
    );
  }

  // Recommended replacement copy when live chat goes live:
  // "Chat live with our team for instant support."
  return (
    <>
      <div 
        className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-[var(--drawer-card-padding-block,0.75rem)] shadow-inner cursor-pointer hover:opacity-90 transition-opacity"
        onClick={toggleChat}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && toggleChat()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
              <FiMessageCircle aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{SUPPORT_DRAWER_COPY.chatbot.placeholder.title}</p>
              <p className="text-[11px] text-text-muted">{SUPPORT_DRAWER_COPY.chatbot.placeholder.description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-transparent p-[var(--drawer-card-padding-block,0.75rem)] text-sm text-text-muted shadow-level1">
            {SUPPORT_DRAWER_COPY.chatbot.placeholder.openingLine}
          </div>
          <textarea
            rows={2}
            disabled
            className="w-full resize-none rounded-xl bg-bg-muted p-[var(--drawer-card-padding-block,0.75rem)] text-sm text-text-muted outline-none"
            placeholder={SUPPORT_DRAWER_COPY.chatbot.placeholder.inputPlaceholder}
          />
        </div>
      </div>
      {isChatOpen && <AtlasChat listingId={listingId} />}
    </>
  );
};

export default ChatbotPlaceholder;
