export const designTokens = {
  color: {
    background: "var(--color-background)",
    surface: "var(--color-surface)",
    mutedSurface: "var(--color-surface-muted)",
    primary: "var(--color-primary)",
    primaryStrong: "var(--color-primary-strong)",
    accent: "var(--color-accent)",
    ink: "var(--color-ink)",
    inkSubtle: "var(--color-ink-subtle)",
    border: "var(--color-border)",
    borderStrong: "var(--color-border-strong)",
    success: "var(--color-success)",
    danger: "var(--color-danger)",
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
    soft: "var(--shadow-soft)",
    strong: "var(--shadow-strong)",
  },
} as const;

export type DesignTokens = typeof designTokens;
