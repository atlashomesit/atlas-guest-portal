import {
  CSSProperties,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiX } from "react-icons/fi";

import { useSupportDrawerFlags } from "./SupportDrawerFlagsContext";

type SupportDrawerView = "home" | "callback" | "faq" | "chat";

type SupportDrawerViewContextValue = {
  view: SupportDrawerView;
  goToHome: () => void;
  goToCallback: () => void;
  goToFaq: () => void;
  goToChat: () => void;
};

const SupportDrawerViewContext = createContext<SupportDrawerViewContextValue | null>(null);

interface SupportDrawerProps {
  bottomSpacing: string;
  children: ReactNode;
  onClose: () => void;
  trustMicrocopy?: ReactNode;
}

const SupportDrawer = ({ bottomSpacing, children, onClose, trustMicrocopy }: SupportDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const { enableClickOutsideToClose, enableCompactDrawer, enableTrustMicrocopy } = useSupportDrawerFlags();
  const [view, setView] = useState<SupportDrawerView>("home");

  const widthClass = useMemo(
    () => (enableCompactDrawer ? "w-[min(92vw,380px)]" : "w-[min(92vw,420px)]"),
    [enableCompactDrawer],
  );

  const containerStyle = useMemo<CSSProperties>(() => {
    if (enableCompactDrawer) {
      return { bottom: bottomSpacing, maxHeight: "65vh" };
    }

    return { bottom: bottomSpacing, top: "5px" };
  }, [bottomSpacing, enableCompactDrawer]);

  const goToHome = useCallback(() => setView("home"), []);
  const goToCallback = useCallback(() => setView("callback"), []);
  const goToFaq = useCallback(() => setView("faq"), []);
  const goToChat = useCallback(() => setView("chat"), []);

  const viewContextValue: SupportDrawerViewContextValue = {
    view,
    goToHome,
    goToCallback,
    goToFaq,
    goToChat,
  };

  useEffect(() => {
    if (!enableClickOutsideToClose) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!drawerRef.current || drawerRef.current.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [enableClickOutsideToClose, onClose]);

  return (
    <SupportDrawerViewContext.Provider value={viewContextValue}>
      <div
        ref={drawerRef}
        className={`fixed right-3 z-[var(--z-floating)] ${widthClass} flex flex-col overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_97%,#f7f4ed_8%)] text-text-primary shadow-level4 ring-1 ring-border-subtle backdrop-blur md:right-5 ${enableCompactDrawer ? "max-h-[65vh]" : ""}`}
        style={containerStyle}
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

        {enableTrustMicrocopy && trustMicrocopy ? (
          <p className="px-4 pb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">{trustMicrocopy}</p>
        ) : null}

        <div className={`min-h-0 flex-1 ${enableCompactDrawer ? "overflow-y-auto" : "overflow-visible"}`}>{children}</div>
      </div>
    </SupportDrawerViewContext.Provider>
  );
};

export const useSupportDrawerView = () => {
  const context = useContext(SupportDrawerViewContext);

  if (!context) {
    throw new Error("useSupportDrawerView must be used within a SupportDrawer");
  }

  return context;
};

export default SupportDrawer;
