// Support drawer UX feature flags. All flags default to false to preserve current behavior.
export const enableCompactDrawer = false;
export const enableRecommendedWhatsAppPrimary = false;
export const enableSecondaryActionsCollapsed = false;
export const enableRevealCallbackOnClickOnly = false;
export const enableHideUnfinishedChatbot = false;
export const enableClickOutsideToClose = false;
export const enableSessionDismissRemember = false;
export const enableTrustMicrocopy = false;

export const supportDrawerFlags = {
  enableCompactDrawer,
  enableRecommendedWhatsAppPrimary,
  enableSecondaryActionsCollapsed,
  enableRevealCallbackOnClickOnly,
  enableHideUnfinishedChatbot,
  enableClickOutsideToClose,
  enableSessionDismissRemember,
  enableTrustMicrocopy,
};

export type SupportDrawerFlags = typeof supportDrawerFlags;
