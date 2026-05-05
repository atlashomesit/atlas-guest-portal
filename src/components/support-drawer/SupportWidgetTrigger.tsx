import { FiMessageCircle } from "react-icons/fi";

import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";

interface SupportWidgetTriggerProps {
  bottomSpacing: string;
  onOpen: () => void;
}

const SupportWidgetTrigger = ({ bottomSpacing, onOpen }: SupportWidgetTriggerProps) => (
  <button
    type="button"
    onClick={onOpen}
    className="fixed right-4 z-[var(--z-floating)] inline-flex items-center gap-3 rounded-full bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f3f0ea_10%)] px-4 py-3 text-sm font-semibold text-text-primary shadow-level3 ring-1 ring-border-subtle transition hover:-translate-y-0.5 hover:shadow-level4 md:right-5"
    style={{ bottom: bottomSpacing }}
    aria-label={SUPPORT_DRAWER_COPY.trigger.ariaLabel}
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cta-primary)_12%,transparent)] text-lg text-accent-primary">
      <FiMessageCircle aria-hidden="true" />
    </span>
    <span className="flex flex-col leading-tight text-left">
      <span className="text-sm font-semibold">{SUPPORT_DRAWER_COPY.trigger.label}</span>
      <span className="text-[11px] text-text-muted">{SUPPORT_DRAWER_COPY.trigger.helper}</span>
    </span>
  </button>
);

export default SupportWidgetTrigger;
