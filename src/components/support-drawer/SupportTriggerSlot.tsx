import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// The App owns the single widget; Search supplies only a React-owned launcher target.
const SupportTriggerSlotContext = createContext<{
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
}>({ target: null, setTarget: () => {} });

export function SupportTriggerSlotProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <SupportTriggerSlotContext.Provider value={value}>{children}</SupportTriggerSlotContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- paired placement context API
export const useSupportTriggerSlot = () => useContext(SupportTriggerSlotContext);

export function SupportTriggerSlot() {
  const { setTarget } = useSupportTriggerSlot();
  return <div ref={setTarget} className="search-support-slot" data-testid="search-support-slot" />;
}
