import { FiMessageCircle } from 'react-icons/fi';
import { SUPPORT_DRAWER_COPY } from '../../config/supportDrawerCopy';
import { useSupportDrawerView } from './SupportDrawer';

/** One native entry in either feature-flag state. The assistant lives in the drawer. */
const ChatbotPlaceholder = () => {
  const { goToAssistant, assistantLaunchRef, restoreAssistantFocusRef } = useSupportDrawerView();

  return (
    <button
      type="button"
      ref={(node) => {
        assistantLaunchRef.current = node;
        if (node && restoreAssistantFocusRef.current) {
          restoreAssistantFocusRef.current = false;
          node.focus();
        }
      }}
      onClick={goToAssistant}
      className="flex w-full items-center gap-2 rounded-2xl border border-border-subtle bg-bg-muted px-3 py-3 text-left shadow-inner transition hover:border-accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-cta-primary">
        <FiMessageCircle aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-text-primary">{SUPPORT_DRAWER_COPY.assistant.entryLabel}</span>
        <span className="block text-[11px] text-text-muted">{SUPPORT_DRAWER_COPY.assistant.entryDescription}</span>
      </span>
    </button>
  );
};

export default ChatbotPlaceholder;
