const parseTokens = (raw: string | null) =>
  raw
    ?.split(",")
    .map((token) => token.trim())
    .filter(Boolean) ?? [];

const readTokens = (key: string) => {
  if (typeof window === "undefined") return [];

  try {
    const urlSearchParams = new URLSearchParams(window.location.search ?? "");
    const queryTokens = parseTokens(urlSearchParams.get(key));
    const storedTokens = parseTokens(window.localStorage.getItem(`atlas_${key}`));
    return Array.from(new Set([...queryTokens, ...storedTokens]));
  } catch (error) {
    console.warn("[ab-flags] unable to read tokens", error);
    return [];
  }
};

/**
 * Lightweight A/B flag resolver that reads comma-separated tokens from
 * the `ab` query param or `atlas_ab` localStorage entry.
 *
 * Example: `?ab=hero_widget_layout` enables the hero widget experiment,
 * while `?ab=!hero_widget_layout` forces the control experience.
 */
export const getAbFlag = (flagName: string, defaultValue = false) => {
  const tokens = readTokens("ab");

  if (tokens.includes(`!${flagName}`)) return false;
  if (tokens.includes(flagName)) return true;

  return defaultValue;
};

export const heroWidgetLayoutFlag = () => getAbFlag("hero_widget_layout", true);
export const bookingWidgetLayoutFlag = () => getAbFlag("booking_widget_layout", true);
