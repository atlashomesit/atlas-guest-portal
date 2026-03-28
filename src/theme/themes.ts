import type { ThemeName } from "../styles/theme";

export const defaultTheme: ThemeName = "default";
export const privateIslandNoirTheme: ThemeName = "privateIslandNoir";
export const jetsetPearlTheme: ThemeName = "jetsetPearl";
export const ultraYachtAzureTheme: ThemeName = "ultraYachtAzure";
export const loversRetreatBlushTheme: ThemeName = "loversRetreatBlush";

export const seasonalThemes: ThemeName[] = ["valentine", "christmas", "newYear"];

export const premiumThemes: ThemeName[] = [
  defaultTheme,
  privateIslandNoirTheme,
  jetsetPearlTheme,
  ultraYachtAzureTheme,
  loversRetreatBlushTheme,
  ...seasonalThemes,
];

export const themeOptions = premiumThemes;

