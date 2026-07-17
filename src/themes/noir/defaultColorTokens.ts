/**
 * TASK-4906 / ADR-0081 D5/D6b — "noir" layout theme's own authored default color palette.
 *
 * Founder-specified visual direction (epic §3.1/ADR-0081 D8, ATLAS-DEVELOPER-TASKS.md
 * TASK-4906): "dark luxury noir" — nocturnal palette, gold accents, full-bleed imagery,
 * minimal chrome. Painted when `effectiveColorPresetId` resolves to `null` (no tenant-chosen
 * or seasonal color preset applies), per D6b — mirrors `heritage/defaultColorTokens.ts`'s
 * pattern and key set exactly so `applyTheme()`'s CSS-variable consumers (TASK-4904 wiring)
 * need no per-layout special-casing.
 *
 * WCAG AA contrast (computed via the standard relative-luminance formula, not eyeballed —
 * TASK-4906's hard bar, epic §3.11/AC14/AC15). Ratios for every text/background pair this
 * palette actually binds to (checked against `SearchAvailabilityWidget`, the shared
 * `PropertyDetailsSkeleton`/booking-flow CSS-variable class usage, and the footer):
 *   --text-primary   (#f5f0e6) / --bg-primary   (#0b0d12)  → 17.11:1
 *   --text-secondary (#c9c2b3) / --bg-primary   (#0b0d12)  → 10.97:1
 *   --text-muted     (#9a9282) / --bg-primary   (#0b0d12)  →  6.30:1
 *   --text-body      (#f5f0e6) / --bg-card      (#171a22)  → 15.31:1
 *   --brand-primary  (#d4af37) / --bg-primary   (#0b0d12)  →  9.24:1  (gold accent text/links)
 *   --brand-accent   (#f0c869) / --bg-primary   (#0b0d12)  → 12.19:1
 *   dark button text (#14171f) / --cta-primary  (#d4af37)  →  8.52:1  (gold CTA button label)
 *   dark button text (#14171f) / --cta-primary-hover (#c19a2c) → 6.76:1
 *   --cta-secondary  (#8f7c4a) / --bg-primary   (#0b0d12)  →  4.77:1
 *   --footer-text    (#c9c2b3) / --footer-bg    (#060709)  → 11.37:1
 *   --footer-link    (#b8aa85) / --footer-bg    (#060709)  →  8.76:1
 *   --support-success(#3ecf8e) / --bg-primary   (#0b0d12)  →  9.74:1
 *   --support-danger (#f2665e) / --bg-primary   (#0b0d12)  →  6.33:1
 *   --border-strong  (#5a6275) / --bg-primary   (#0b0d12)  →  3.18:1  (UI-component threshold,
 *                                                                       not text — 3:1 per WCAG
 *                                                                       1.4.11 non-text contrast)
 * All normal-text pairs clear the 4.5:1 AA threshold with margin; `--border-subtle` is
 * decorative-only (never bound to text or a meaningful UI boundary) and is not held to a
 * contrast minimum, same convention as every other palette in this registry/`themeRegistry`.
 */
export const noirDefaultColorTokens: Readonly<Record<string, string>> = {
  "--bg-primary": "#0b0d12",
  "--bg-secondary": "#14171f",
  "--bg-card": "#171a22",
  "--bg-surface": "#12141b",
  "--bg-muted": "#1c2029",

  "--brand-primary": "#d4af37",
  "--brand-accent": "#f0c869",
  "--brand-soft": "#2a2415",
  "--accent-primary": "#d4af37",
  "--accent-soft": "#2a2415",
  "--romance-soft": "#2a2415",
  "--accent-primary-rgb": "212 175 55",
  "--accent-soft-rgb": "42 36 21",

  "--cta-primary": "#d4af37",
  "--cta-primary-hover": "#c19a2c",
  "--cta-secondary": "#8f7c4a",
  "--cta-primary-rgb": "212 175 55",
  "--cta-primary-hover-rgb": "193 154 44",
  "--cta-secondary-rgb": "143 124 74",

  "--text-primary": "#f5f0e6",
  "--text-secondary": "#c9c2b3",
  "--text-muted": "#9a9282",
  "--text-body": "#f5f0e6",
  "--text-on-hero": "#ffffff",

  "--success": "#3ecf8e",
  "--support-success": "#3ecf8e",
  "--support-danger": "#f2665e",
  "--support-error": "#f2665e",
  "--border": "#232733",
  "--border-subtle": "#232733",
  "--border-strong": "#5a6275",

  "--gradient-hero": "linear-gradient(135deg, #0b0d12 0%, #14171f 50%, #1c2029 100%)",
  "--gradient-cta": "linear-gradient(135deg, #d4af37, #f0c869)",
  "--gradient-card": "linear-gradient(180deg, rgba(212, 175, 55, 0.04) 0%, transparent 100%)",

  "--brand": "#d4af37",
  "--brand-ink": "#f5f0e6",
  "--brand-contrast": "#0b0d12",

  "--footer-bg": "#060709",
  "--footer-text": "#c9c2b3",
  "--footer-heading": "#f5f0e6",
  "--footer-link": "#b8aa85",
  "--footer-link-hover": "#f0c869",

  "--shadow-level-1": "0 8px 24px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)",
  "--shadow-level-2": "0 18px 48px rgba(0, 0, 0, 0.45), 0 8px 20px rgba(0, 0, 0, 0.35)",
  "--shadow-level-3": "0 28px 72px rgba(0, 0, 0, 0.55), 0 12px 32px rgba(0, 0, 0, 0.45)",
  "--shadow-1": "var(--shadow-level-1)",
  "--shadow-2": "var(--shadow-level-2)",
  "--shadow-3": "var(--shadow-level-3)",
};
