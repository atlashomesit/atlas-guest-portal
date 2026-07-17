/**
 * TASK-4914 / ADR-0081 D5/D6b (2026-07-17 evening amendment) — `heritage`'s own authored
 * default color palette, recovered verbatim from the pre-coral
 * `src/styles/themes/default.css` ("Luxury Hotel Theme — Warm ivory, coral & amber",
 * `d1ab2590^`).
 *
 * Per D6b, `effectiveColorPresetId` resolving to `null` (no tenant-chosen or seasonal
 * color preset applies to this layout) means the guest portal should paint this layout's
 * own baked default tokens instead of the `default` (Sandstone Coral) color-preset CSS.
 * `heritage` declares `supportedColorPresets: []` (`registry.ts`) — it does not opt into
 * any of the 14 shared color presets, so this is its only palette.
 *
 * Declared as data only (ADR-0081 amendment 2026-07-17 pt.5 — theme selection/painting
 * must stay a runtime read, never a build-time input). Runtime application — painting
 * these CSS custom properties onto `document.documentElement` when the resolved layout is
 * `heritage` and `effectiveColorPresetId` is null — is TASK-4904's boot-wiring scope
 * (`src/main.tsx`'s `applyTheme()` call currently always resolves to the shared
 * `default`/Sandstone-Coral CSS-variable set; making it layout-aware is that task's
 * wiring, not invented here per this task's "do not build a new prod-facing selection
 * surface" instruction).
 */
export const heritageDefaultColorTokens: Readonly<Record<string, string>> = {
  "--bg-primary": "#fffaf5",
  "--bg-secondary": "#fff3e8",
  "--bg-card": "#ffffff",
  "--bg-surface": "#ffffff",
  "--bg-muted": "#fff3e8",

  "--brand-primary": "#c2410c",
  "--brand-accent": "#ffb347",
  "--brand-soft": "#ffe8d6",
  "--accent-primary": "#c2410c",
  "--accent-soft": "#ffe8d6",
  "--romance-soft": "#ffe8d6",
  "--accent-primary-rgb": "194 65 12",
  "--accent-soft-rgb": "255 232 214",

  "--cta-primary": "#c2410c",
  "--cta-primary-hover": "#a8350a",
  "--cta-secondary": "#6b7280",
  "--cta-primary-rgb": "194 65 12",
  "--cta-primary-hover-rgb": "168 53 10",
  "--cta-secondary-rgb": "107 114 128",

  "--text-primary": "#1a1a2e",
  "--text-secondary": "#64748b",
  "--text-muted": "#475569",
  "--text-body": "#1a1a2e",
  "--text-on-hero": "#ffffff",

  "--success": "#10b981",
  "--support-success": "#10b981",
  "--support-danger": "#dc2626",
  "--support-error": "#dc2626",
  "--border": "#f0e6dc",
  "--border-subtle": "#f0e6dc",
  "--border-strong": "#e5d9ce",

  "--gradient-hero": "linear-gradient(135deg, #fffaf5 0%, #ffe8d6 50%, #fff3e8 100%)",
  "--gradient-cta": "linear-gradient(135deg, #ff6b35, #ffb347)",
  "--gradient-card": "linear-gradient(180deg, rgba(255, 107, 53, 0.03) 0%, transparent 100%)",

  "--brand": "#c2410c",
  "--brand-ink": "#1a1a2e",
  "--brand-contrast": "#fffaf5",

  "--footer-bg": "#1a1a2e",
  "--footer-text": "#9ca3af",
  "--footer-heading": "#fffaf5",
  "--footer-link": "#9ca3af",
  "--footer-link-hover": "#ffffff",

  "--shadow-level-1": "0 2px 8px rgba(26, 26, 46, 0.04), 0 1px 3px rgba(26, 26, 46, 0.02)",
  "--shadow-level-2": "0 8px 24px rgba(26, 26, 46, 0.06), 0 4px 12px rgba(26, 26, 46, 0.03)",
  "--shadow-level-3": "0 24px 72px rgba(26, 26, 46, 0.08), 0 12px 32px rgba(26, 26, 46, 0.04)",
  "--shadow-1": "var(--shadow-level-1)",
  "--shadow-2": "var(--shadow-level-2)",
  "--shadow-3": "var(--shadow-level-3)",
};
