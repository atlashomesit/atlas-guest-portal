import { defaultFeatureFlags, getFeatureFlags } from "./featureFlags";

// Deprecated: prefer importing getFeatureFlags directly from featureFlags.ts.
export const supportDrawerFlags = getFeatureFlags();

export type SupportDrawerFlags = typeof defaultFeatureFlags;
