export const themeRegistry = {
  default: { 
    label: "Ivory Peach",
    description: "Ivory canvas, peach-to-lilac hero, coral CTAs and maroon ink"
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

// ---------------------------------------------------------------------------------------
// Layout-theme baked palettes (ADR-0081 D5/D6b).
//
// A layout theme (`src/themes/registry.ts`) may ship its own authored `defaultColorTokens`.
// Those are the layout's DEFAULT palette — not a hard override — so the resolved precedence,
// weakest to strongest, is:
//
//   1. base CSS            `src/styles/themes/*.css` (`:root`, `:root[data-theme="…"]`)
//   2. layout defaults     the injected rule below
//   3. color preset        a preset the layout declares in `supportedColorPresets` (D6)
//   4. tenant branding     `applyTenantBranding()`'s inline `style` properties
//
// (2) beats (1) via an `html:root[…]` selector — specificity (0,2,1) — which clears
// `default.css`'s own `:root[data-theme="default"]` (0,2,0) *deterministically*, rather than
// relying on stylesheet insertion order (Vite emits CSS differently in dev vs build).
//
// (3) beats (2) by MUTUAL EXCLUSION rather than by cascade: `applyTheme()` drops the
// `data-layout-theme` attribute whenever a non-default preset is active, so the two rules
// never compete. Cascade alone could not express this — a preset rule and `default.css`'s
// own `[data-theme="default"]` rule have identical specificity, leaving no weight to sit
// between them.
//
// (4) wins for free: inline `style` properties always outrank any stylesheet rule, so a
// tenant's custom `primaryColor` survives regardless of the order these run in at boot.
// ---------------------------------------------------------------------------------------
const LAYOUT_TOKENS_STYLE_ELEMENT_ID = "atlas-layout-theme-default-tokens";

/** Layout id whose baked palette is currently installed, or `null` if none is. */
let installedLayoutTokensThemeId: string | null = null;

const escapeCssAttributeValue = (value: string): string => value.replace(/["\\]/g, "\\$&");

/**
 * Installs a layout theme's baked `defaultColorTokens` as a scoped stylesheet rule.
 *
 * Call this BEFORE `applyTheme()` at boot — `applyTheme()` decides whether the palette is
 * actually painted (no/unsupported preset) or stood down (a supported preset overrides it).
 * Passing no tokens (e.g. `classic`, which has none) uninstalls any previous palette.
 */
export const applyLayoutDefaultColorTokens = (
  layoutThemeId: string,
  tokens?: Readonly<Record<string, string>>,
) => {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(LAYOUT_TOKENS_STYLE_ELEMENT_ID);

  if (!tokens || Object.keys(tokens).length === 0) {
    existing?.remove();
    installedLayoutTokensThemeId = null;
    delete document.documentElement.dataset.layoutTheme;
    return;
  }

  const declarations = Object.entries(tokens)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join("\n");

  const style = existing ?? document.createElement("style");
  style.id = LAYOUT_TOKENS_STYLE_ELEMENT_ID;
  style.textContent =
    `html:root[data-layout-theme="${escapeCssAttributeValue(layoutThemeId)}"] {\n${declarations}\n}\n`;
  if (!existing) document.head.appendChild(style);

  installedLayoutTokensThemeId = layoutThemeId;
};

export const applyTheme = (theme: string = DEFAULT_THEME) => {
  if (typeof document === "undefined") return;

  const resolvedTheme: ThemeName = isRegisteredTheme(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = resolvedTheme;

  // ADR-0081 D6 — an active color preset overrides the layout's baked defaults; anything
  // else (no preset, or one this layout does not declare, which callers resolve to
  // `DEFAULT_THEME`) falls back to them. Keeping this here means runtime preset switches
  // (`ThemeProvider`, the dev switcher) get the same precedence as the boot path.
  if (installedLayoutTokensThemeId) {
    if (resolvedTheme === DEFAULT_THEME) {
      document.documentElement.dataset.layoutTheme = installedLayoutTokensThemeId;
    } else {
      delete document.documentElement.dataset.layoutTheme;
    }
  }
};

/** Test-only: uninstall the layout palette (module state outlives test files under isolate:false). */
export const _resetLayoutDefaultColorTokensForTests = (): void => {
  applyLayoutDefaultColorTokens("", undefined);
};
