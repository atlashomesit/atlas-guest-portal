import { FiMessageCircle } from "react-icons/fi";

type ChatbotPlaceholderProps = {
  enableHideUnfinishedChatbot?: boolean;
};

const ChatbotPlaceholder = ({ enableHideUnfinishedChatbot = false }: ChatbotPlaceholderProps) => {
  if (enableHideUnfinishedChatbot) {
    return (
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-3 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
            <FiMessageCircle aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Chat support</p>
            <p className="text-[11px] text-text-muted">Prefer chat? Message us on WhatsApp for instant support.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-muted)_92%,#f9f6f1_12%)] p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
            <FiMessageCircle aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Chat interface</p>
            <p className="text-[11px] text-text-muted">Placeholder while backend wiring is in progress.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-xl bg-bg-surface p-3 text-sm text-text-muted shadow-level1">
          Hi there! Ask about check-in rules, cancellations, parking, or anything else about your stay.
        </div>
        <textarea
          rows={2}
          disabled
          className="w-full resize-none rounded-xl border border-border-subtle bg-bg-muted p-3 text-sm text-text-muted outline-none"
          placeholder="Messaging coming soon"
        />
      </div>
    </div>
  );
};

export default ChatbotPlaceholder;
