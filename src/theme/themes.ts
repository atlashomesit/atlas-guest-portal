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
  ...seasonalThemes,
];

export const themeOptions = premiumThemes;

