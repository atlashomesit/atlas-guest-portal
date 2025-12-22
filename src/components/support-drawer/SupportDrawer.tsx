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

import { SUPPORT_DRAWER_COPY } from "../../config/supportDrawerCopy";
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
  enableCloseReassurance?: boolean;
  layoutVariant?: SupportDrawerLayoutVariant;
  onClose: () => void;
  trustMicrocopy?: ReactNode;
}

type SupportDrawerLayoutVariant = "legacy" | "fullHeightDrawer" | "compactDrawer";

const SUPPORT_DRAWER_SPACING = {
  cardPaddingBlock: "0.75rem",
  cardPaddingInline: "1rem",
  sectionGap: "0.75rem",
} as const;

const SupportDrawer = ({
  bottomSpacing,
  children,
  enableCloseReassurance,
  layoutVariant,
  onClose,
  trustMicrocopy,
}: SupportDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const {
    enableClickOutsideToClose,
    enableCompactDrawer,
    enableDrawerStructureTokens,
    enableSupportLayoutVariants,
    enableTrustMicrocopy,
  } = useSupportDrawerFlags();
  const [view, setView] = useState<SupportDrawerView>("home");

  const resolvedLayoutVariant: SupportDrawerLayoutVariant = useMemo(() => {
    if (enableSupportLayoutVariants) {
      return layoutVariant ?? (enableCompactDrawer ? "compactDrawer" : "fullHeightDrawer");
    }
    return enableCompactDrawer ? "compactDrawer" : "legacy";
  }, [enableCompactDrawer, enableSupportLayoutVariants, layoutVariant]);

  const widthClass = useMemo(
    () => (resolvedLayoutVariant === "compactDrawer" ? "w-[min(92vw,380px)]" : "w-[min(92vw,420px)]"),
    [resolvedLayoutVariant],
  );

  const containerStyle = useMemo<CSSProperties>(() => {
    if (resolvedLayoutVariant === "compactDrawer") {
      return { bottom: bottomSpacing, maxHeight: "65vh" };
    }

    return { bottom: bottomSpacing, top: "5px" };
  }, [bottomSpacing, resolvedLayoutVariant]);

  const spacingTokens = useMemo<CSSProperties>(
    () =>
      enableDrawerStructureTokens
        ? {
            "--drawer-card-padding-block": SUPPORT_DRAWER_SPACING.cardPaddingBlock,
            "--drawer-card-padding-inline": SUPPORT_DRAWER_SPACING.cardPaddingInline,
            "--drawer-section-gap": SUPPORT_DRAWER_SPACING.sectionGap,
          }
        : {},
    [enableDrawerStructureTokens],
  );

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
        className={`fixed right-3 z-[var(--z-floating)] ${widthClass} flex flex-col overflow-hidden rounded-3xl border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_97%,#f7f4ed_8%)] text-text-primary shadow-level4 ring-1 ring-border-subtle backdrop-blur md:right-5 ${
          resolvedLayoutVariant === "compactDrawer" ? "max-h-[65vh]" : ""
        }`}
        style={{ ...containerStyle, ...spacingTokens }}
      >
        <div className="flex items-start justify-between gap-[var(--drawer-section-gap,0.75rem)] bg-[color-mix(in_srgb,var(--bg-surface)_96%,#f2efe8_18%)] px-[var(--drawer-card-padding-inline,1rem)] py-[var(--drawer-card-padding-block,0.75rem)]">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-text-primary">{SUPPORT_DRAWER_COPY.header.title}</p>
            <p className="text-xs text-text-muted">{SUPPORT_DRAWER_COPY.header.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full ${enableCloseReassurance ? "p-2.5" : "p-2"} text-text-muted transition hover:bg-bg-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-strong`}
              aria-label={SUPPORT_DRAWER_COPY.controls.closeAriaLabel}
            >
              <FiX aria-hidden="true" size={enableCloseReassurance ? 26 : 24} />
            </button>
            {enableCloseReassurance ? (
              <span className="max-w-[180px] text-right text-[11px] font-medium leading-4 text-text-muted">
                {SUPPORT_DRAWER_COPY.controls.closeReassurance}
              </span>
            ) : null}
          </div>
        </div>

        {enableTrustMicrocopy && trustMicrocopy ? (
          <p className="px-[var(--drawer-card-padding-inline,1rem)] pb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            {trustMicrocopy}
          </p>
        ) : null}

        <div
          className={`min-h-0 flex-1 ${resolvedLayoutVariant === "compactDrawer" ? "overflow-y-auto" : "overflow-visible"}`}
        >
          {children}
        </div>
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
