/**
 * TASK-4907 / ADR-0081 D5/D6b/D8 — "coastal" layout's own authored default color palette.
 *
 * Founder-specified visual direction (epic §3.1, ADR-0081 D8): "light sea-blue palette,
 * horizontal gallery layouts, wave-motif accents — an airy, coastal-stay register."
 *
 * Painted when `effectiveColorPresetId` resolves to `null` (D6b — no tenant-chosen or
 * seasonal color preset applies). Mirrors `heritage/defaultColorTokens.ts`'s shape/keys
 * (TASK-4914 precedent) so the same CSS-variable surface every shared component already
 * reads works unchanged for this layout too. Runtime application (painting these onto
 * `document.documentElement` when resolved layout is `coastal` and no preset is active)
 * is TASK-4904's boot-wiring scope, not invented here — same "data only" note as heritage's
 * file.
 *
 * WCAG AA verified (2026-07-17, computed via WCAG relative-luminance formula, not eyeballed
 * — see PR description for the full ratio table):
 *   --text-primary / --text-body (#082f3a) on --bg-primary (#f2fbfd): 13.53:1
 *   --text-primary / --text-body (#082f3a) on --bg-secondary (#e3f5fa): 12.66:1
 *   --text-primary / --text-body (#082f3a) on #ffffff (card surfaces): 14.21:1
 *   --text-secondary (#3a6b78) on --bg-primary (#f2fbfd): 5.63:1
 *   --cta-primary (#0e7490) on #ffffff / --bg-secondary: 5.36:1 / 4.77:1
 *   --footer-text (#a9cdd6) on --footer-bg (#082f3a): 8.38:1
 * All pass the 4.5:1 normal-text AA threshold. `--text-muted` (#5c8a96, ~3.61:1 on
 * --bg-primary) intentionally stays below 4.5:1 — per this layout's own Home.tsx
 * composition, it is never bound to normal-size body text (only to large/decorative UI),
 * consistent with the ≥3:1 large-text/UI-component threshold.
 */
export const coastalDefaultColorTokens: Readonly<Record<string, string>> = {
  "--bg-primary": "#f2fbfd",
  "--bg-secondary": "#e3f5fa",
  "--bg-card": "#ffffff",
  "--bg-surface": "#ffffff",
  "--bg-muted": "#e3f5fa",

  "--brand-primary": "#0e7490",
  "--brand-accent": "#22b8d8",
  "--brand-soft": "#cdf1f9",
  "--accent-primary": "#0e7490",
  "--accent-soft": "#cdf1f9",
  "--romance-soft": "#cdf1f9",
  "--accent-primary-rgb": "14 116 144",
  "--accent-soft-rgb": "205 241 249",

  "--cta-primary": "#0e7490",
  "--cta-primary-hover": "#0b5a70",
  "--cta-secondary": "#22b8d8",
  "--cta-primary-rgb": "14 116 144",
  "--cta-primary-hover-rgb": "11 90 112",
  "--cta-secondary-rgb": "34 184 216",

  "--text-primary": "#082f3a",
  "--text-secondary": "#3a6b78",
  "--text-muted": "#5c8a96",
  "--text-body": "#082f3a",
  "--text-on-hero": "#ffffff",

  "--success": "#10b981",
  "--support-success": "#10b981",
  "--support-danger": "#dc2626",
  "--support-error": "#dc2626",
  "--border": "#d3edf3",
  "--border-subtle": "#d3edf3",
  "--border-strong": "#b7e0ea",

  "--gradient-hero": "linear-gradient(135deg, #f2fbfd 0%, #cdf1f9 50%, #e3f5fa 100%)",
  "--gradient-cta": "linear-gradient(135deg, #0e7490, #22b8d8)",
  "--gradient-card": "linear-gradient(180deg, rgba(14, 116, 144, 0.04) 0%, transparent 100%)",

  "--brand": "#0e7490",
  "--brand-ink": "#082f3a",
  "--brand-contrast": "#f2fbfd",

  "--footer-bg": "#082f3a",
  "--footer-text": "#a9cdd6",
  "--footer-heading": "#f2fbfd",
  "--footer-link": "#a9cdd6",
  "--footer-link-hover": "#ffffff",

  "--shadow-level-1": "0 2px 8px rgba(8, 47, 58, 0.05), 0 1px 3px rgba(8, 47, 58, 0.03)",
  "--shadow-level-2": "0 8px 24px rgba(8, 47, 58, 0.08), 0 4px 12px rgba(8, 47, 58, 0.04)",
  "--shadow-level-3": "0 24px 72px rgba(8, 47, 58, 0.10), 0 12px 32px rgba(8, 47, 58, 0.05)",
  "--shadow-1": "var(--shadow-level-1)",
  "--shadow-2": "var(--shadow-level-2)",
  "--shadow-3": "var(--shadow-level-3)",
};
