type FeatureFlagKey =
  | "enableCompactDrawer"
  | "enableSupportLayoutVariants"
  | "enableRecommendedWhatsAppPrimary"
  | "enableSecondaryActionsCollapsed"
  | "enableRevealCallbackOnClickOnly"
  | "enableHideUnfinishedChatbot"
  | "enableChatbotPlaceholder"
  | "enableClickOutsideToClose"
  | "enableSupportCtaHierarchy"
  | "enableSessionDismissRemember"
  | "enableTrustMicrocopy"
  | "enableCloseReassurance";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  enableCompactDrawer: true,
  enableSupportLayoutVariants: false,
  enableRecommendedWhatsAppPrimary: false,
  enableSecondaryActionsCollapsed: true,
  enableRevealCallbackOnClickOnly: true,
  enableHideUnfinishedChatbot: true,
  enableChatbotPlaceholder: true,
  enableClickOutsideToClose: true,
  enableSupportCtaHierarchy: true,
  enableSessionDismissRemember: false,
  enableTrustMicrocopy: false,
  enableCloseReassurance: false,
};

const FLAG_TOKEN_MAP: Record<string, FeatureFlagKey> = {
  compactDrawer: "enableCompactDrawer",
  layoutVariants: "enableSupportLayoutVariants",
  whatsappPrimary: "enableRecommendedWhatsAppPrimary",
  collapseSecondary: "enableSecondaryActionsCollapsed",
  revealCallback: "enableRevealCallbackOnClickOnly",
  hideChatbot: "enableHideUnfinishedChatbot",
  chatPlaceholder: "enableChatbotPlaceholder",
  ctaHierarchy: "enableSupportCtaHierarchy",
  trustMicrocopy: "enableTrustMicrocopy",
  closeReassurance: "enableCloseReassurance",
};
// To trial compact drawer + CTA hierarchy safely, prefer enabling with URL/localStorage tokens like:
//   ?ff=layoutVariants,compactDrawer,ctaHierarchy
// Keeping layoutVariants off will retain the legacy sizing and action ordering.

const parseTokens = (raw: string | null) =>
  raw
    ?.split(",")
    .map((token) => token.trim())
    .filter(Boolean) ?? [];

const readLocalStorageTokens = () => {
  if (typeof window === "undefined") return [];
  try {
    return parseTokens(window.localStorage.getItem("atlas_ff"));
  } catch (error) {
    console.warn("[feature-flags] unable to read localStorage overrides", error);
    return [];
  }
};

const applyTokenOverrides = (flags: FeatureFlags, tokens: string[]) => {
  const overrides: FeatureFlags = { ...flags };

  tokens.forEach((token) => {
    const flagKey = FLAG_TOKEN_MAP[token];
    if (flagKey) {
      overrides[flagKey] = true;
    }
  });

  return overrides;
};

export const getFeatureFlags = (): FeatureFlags => {
  const baseFlags = { ...DEFAULT_FLAGS };
  if (typeof window === "undefined") return baseFlags;

  const urlSearchParams = new URLSearchParams(window.location.search ?? "");
  const queryTokens = parseTokens(urlSearchParams.get("ff"));
  const isProd = import.meta.env.PROD;

  const allowOverrides = !isProd || queryTokens.length > 0;

  const collectedTokens = new Set<string>();

  if (allowOverrides) {
    queryTokens.forEach((token) => collectedTokens.add(token));
    readLocalStorageTokens().forEach((token) => collectedTokens.add(token));
  }

  const finalFlags = applyTokenOverrides(baseFlags, Array.from(collectedTokens));

  if (import.meta.env.DEV) {
    const activeFlags = Object.entries(finalFlags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag);
    console.info("[feature-flags] support drawer flags", activeFlags.length ? activeFlags : "none active");
  }

  return finalFlags;
};

export const defaultFeatureFlags = DEFAULT_FLAGS;
