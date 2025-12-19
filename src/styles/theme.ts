export const DEFAULT_THEME = "default" as const;

export const designTokens = {
  bg: {
    primary: "var(--bg-primary)",
    surface: "var(--bg-surface)",
    muted: "var(--bg-muted)",
  },
  text: {
    primary: "var(--text-primary)",
    muted: "var(--text-muted)",
  },
  accent: {
    primary: "var(--accent-primary)",
    soft: "var(--accent-soft)",
  },
  cta: {
    primary: "var(--cta-primary)",
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

export type ThemeName = typeof DEFAULT_THEME;

export const applyTheme = (theme: ThemeName = DEFAULT_THEME) => {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
};
