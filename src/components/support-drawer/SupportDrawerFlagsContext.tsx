import { ReactNode, createContext, useContext, useMemo } from "react";

import type { FeatureFlags } from "../../config/featureFlags";

interface SupportDrawerFlagsProviderProps {
  children: ReactNode;
  flags: FeatureFlags;
}

const SupportDrawerFlagsContext = createContext<FeatureFlags | null>(null);

export const SupportDrawerFlagsProvider = ({ children, flags }: SupportDrawerFlagsProviderProps) => {
  const memoizedFlags = useMemo(() => flags, [flags]);

  return <SupportDrawerFlagsContext.Provider value={memoizedFlags}>{children}</SupportDrawerFlagsContext.Provider>;
};

export const useSupportDrawerFlags = () => {
  const context = useContext(SupportDrawerFlagsContext);

  if (!context) {
    throw new Error("useSupportDrawerFlags must be used within a SupportDrawerFlagsProvider");
  }

  return context;
};
