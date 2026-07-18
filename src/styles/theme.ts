export const themeRegistry = {
  default: { 
    label: "Sandstone Coral",
    description: "Cream, coral peach & soft lavender — light heritage stay skin"
  },
  privateIslandNoir: {
    label: "Private Island Noir",
    description: "Nocturnal island luxe with gold accents and candlelit mood"
  },
  jetsetPearl: {
    label: "Jetset Pearl",
    description: "Pearl white with rose-gold sunrise accents"
  },
  ultraYachtAzure: {
    label: "Ultra Yacht Azure",
    description: "Superyacht Monaco elegance with sapphire sea and silver accents"
  },
  loversRetreatBlush: {
    label: "Lovers Retreat Blush",
    description: "Honeymoon suite warmth with champagne gold and blush rose"
  },
  emeraldDynasty: {
    label: "Emerald Dynasty",
    description: "Royal dark emerald palace with elite gold accents",
    category: "Premium"
  },
  auroraChampagne: {
    label: "Aurora Champagne",
    description: "Dreamy champagne penthouse sunrise with glassy glow",
    category: "Premium"
  },
  sunriseCoral: {
    label: "Sunrise Coral",
    description: "Light peach sunrise with vibrant coral accents",
    category: "Light Vibrant"
  },
  oceanLuxury: {
    label: "Ocean Luxury",
    description: "Airy aqua blues for coastal stays",
    category: "Light Vibrant"
  },
  emeraldOasis: {
    label: "Emerald Oasis",
    description: "Fresh mint greens on soft light grounds",
    category: "Light Vibrant"
  },
  royalViolet: {
    label: "Royal Violet",
    description: "Soft lilac washes with vivid violet accents",
    category: "Light Vibrant"
  },
  valentine: { 
    label: "Romantic Rose",
    description: "Soft rose tones for Valentine's Day"
  },
  christmas: { 
    label: "Festive Evergreen",
    description: "Classic red and green for the holidays"
  },
  newYear: { 
    label: "Celebration Gold",
    description: "Midnight blue and champagne gold for New Year"
  },
} as const;

export type ThemeName = keyof typeof themeRegistry;

export const DEFAULT_THEME: ThemeName = "default";

export const designTokens = {
  bg: {
    primary: "var(--bg-primary)",
    surface: "var(--bg-surface)",
    muted: "var(--bg-muted)",
  },
  text: {
    primary: "var(--text-primary)",
    muted: "var(--text-muted)",
    onHero: "var(--text-on-hero)",
  },
  accent: {
    primary: "var(--accent-primary)",
    soft: "var(--accent-soft)",
  },
  cta: {
    primary: "var(--cta-primary)",
    primaryHover: "var(--cta-primary-hover)",
    secondary: "var(--cta-secondary)",
  },
  border: {
    subtle: "var(--border-subtle)",
    strong: "var(--border-strong)",
  },
  state: {
    success: "var(--support-success)",
    danger: "var(--support-danger)",
  },
  footer: {
    background: "var(--footer-bg)",
  },
  typography: {
    base: "var(--font-family-base)",
    display: "var(--font-family-display)",
    size: {
      xs: "var(--font-size-xs)",
      sm: "var(--font-size-sm)",
      md: "var(--font-size-md)",
      lg: "var(--font-size-lg)",
      xl: "var(--font-size-xl)",
      twoXL: "var(--font-size-2xl)",
      threeXL: "var(--font-size-3xl)",
    },
    lineHeight: {
      tight: "var(--line-height-tight)",
      snug: "var(--line-height-snug)",
      relaxed: "var(--line-height-relaxed)",
    },
  },
  spacing: {
    1: "var(--space-1)",
    2: "var(--space-2)",
    3: "var(--space-3)",
    4: "var(--space-4)",
    5: "var(--space-5)",
    6: "var(--space-6)",
    8: "var(--space-8)",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    pill: "var(--radius-pill)",
  },
  shadow: {
    level1: "var(--shadow-level-1)",
    level2: "var(--shadow-level-2)",
  },
  zIndex: {
    base: "var(--z-base)",
    dropdown: "var(--z-dropdown)",
    sticky: "var(--z-sticky)",
    floating: "var(--z-floating)",
    overlay: "var(--z-overlay)",
    modal: "var(--z-modal)",
    toast: "var(--z-toast)",
  },
  safeArea: {
    top: "var(--safe-area-top)",
    right: "var(--safe-area-right)",
    bottom: "var(--safe-area-bottom)",
    left: "var(--safe-area-left)",
  },
} as const;

export type DesignTokens = typeof designTokens;

const isRegisteredTheme = (theme: string): theme is ThemeName => {
  return theme in themeRegistry;
};

export const availableThemes = Object.keys(themeRegistry) as ThemeName[];

/**
 * Narrow an arbitrary (DB-sourced, possibly stale/unknown) preset id to a registered
 * `ThemeName`, falling back to `DEFAULT_THEME`. Exported so callers that need the resolved
 * value as a *typed* `ThemeName` (e.g. `src/main.tsx` seeding `ThemeProvider.initialTheme`)
 * share `applyTheme()`'s fallback rule instead of re-implementing it.
 */
export const resolveThemeName = (theme: string = DEFAULT_THEME): ThemeName =>
  isRegisteredTheme(theme) ? theme : DEFAULT_THEME;

export const applyTheme = (theme: string = DEFAULT_THEME) => {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = resolveThemeName(theme);
};
