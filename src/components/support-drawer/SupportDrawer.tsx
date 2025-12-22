import { ReactNode } from "react";
import { FiX } from "react-icons/fi";

interface SupportDrawerProps {
  bottomSpacing: string;
  children: ReactNode;
  onClose: () => void;
}

const SupportDrawer = ({ bottomSpacing, children, onClose }: SupportDrawerProps) => (
  <div
    className="fixed right-3 z-[var(--z-floating)] w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_97%,#f7f4ed_8%)] text-text-primary shadow-level4 ring-1 ring-border-subtle backdrop-blur md:right-5"
    style={{ bottom: bottomSpacing, top: "5px" }}
  >
    <div className="flex items-start justify-between gap-3 bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f2efe8_18%)] px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-text-primary">Need a hand?</p>
        <p className="text-xs text-text-muted">Chat with Atlas or jump to WhatsApp/callback without losing your place.</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full p-2 text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong"
        aria-label="Close support widget"
      >
        <FiX aria-hidden="true" />
      </button>
    </div>

    {children}
  </div>
);

export default SupportDrawer;
