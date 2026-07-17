import type { ThemeName } from "../styles/theme";

export const defaultTheme: ThemeName = "default";
export const privateIslandNoirTheme: ThemeName = "privateIslandNoir";
export const jetsetPearlTheme: ThemeName = "jetsetPearl";
export const ultraYachtAzureTheme: ThemeName = "ultraYachtAzure";
export const loversRetreatBlushTheme: ThemeName = "loversRetreatBlush";
export const sunriseCoralTheme: ThemeName = "sunriseCoral";
export const oceanLuxuryTheme: ThemeName = "oceanLuxury";
export const emeraldOasisTheme: ThemeName = "emeraldOasis";
export const royalVioletTheme: ThemeName = "royalViolet";
// TASK-4903 / ADR-0081 amendment 2026-07-17 evening (D9 housekeeping): these two already
// carry `category: "Premium"` in `styles/theme.ts`'s `themeRegistry` but had no corresponding
// constant/export here — an oversight, not a deliberate exclusion. Reconciled so every
// `themeRegistry` key not intentionally retired appears in this dev-switcher option list.
export const emeraldDynastyTheme: ThemeName = "emeraldDynasty";
export const auroraChampagneTheme: ThemeName = "auroraChampagne";

export const seasonalThemes: ThemeName[] = ["valentine", "christmas", "newYear"];

export const lightVibrantThemes: ThemeName[] = [
  sunriseCoralTheme,
  oceanLuxuryTheme,
  emeraldOasisTheme,
  royalVioletTheme,
];

export const premiumThemes: ThemeName[] = [
  defaultTheme,
  ...lightVibrantThemes,
  privateIslandNoirTheme,
  jetsetPearlTheme,
  ultraYachtAzureTheme,
  loversRetreatBlushTheme,
  emeraldDynastyTheme,
  auroraChampagneTheme,
  ...seasonalThemes,
];

export const themeOptions = premiumThemes;

