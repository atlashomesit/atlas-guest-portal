/**
 * TASK-4906 / ADR-0081 D5/D6b — "noir" layout theme's own authored default color palette.
 *
 * Founder-specified visual direction (epic §3.1/ADR-0081 D8, ATLAS-DEVELOPER-TASKS.md
 * TASK-4906): "dark luxury noir" — nocturnal palette, gold accents, full-bleed imagery,
 * minimal chrome. Painted when `effectiveColorPresetId` resolves to `null` (no tenant-chosen
 * or seasonal color preset applies), per D6b — mirrors `heritage/defaultColorTokens.ts`'s
 * pattern and key set exactly so `applyTheme()`'s CSS-variable consumers (painted at boot by
 * `applyLayoutDefaultColorTokens()` in `src/styles/theme.ts`) need no per-layout special-casing.
 *
 * WCAG AA contrast (computed via the standard relative-luminance formula, not eyeballed —
 * TASK-4906's hard bar, epic §3.11/AC14/AC15). Ratios for every text/background pair this
 * palette actually binds to (checked against `SearchAvailabilityWidget`, the shared
 * `PropertyDetailsSkeleton`/booking-flow CSS-variable class usage, and the footer).
 *
 * CORRECTION (2026-07-18): the two CTA-button rows below previously read "dark button text
 * (#14171f)" and this header claimed every pair cleared 4.5:1. That was aspirational — no
 * such token existed. The shared button surfaces (`ui.css`'s `.rb-button` and
 * `SearchAvailabilityWidget`'s hero search button) resolved their label to `--text-contrast`,
 * which `base.css` pins to #ffffff and nothing overrode — so this gold CTA rendered WHITE
 * text at 2.10:1, well under the 4.5:1 normal-text floor. Fixed by introducing
 * `--text-on-cta` (declared below, defined in `base.css`) and binding the real CTA fills to
 * it, rather than lightening the gold, which would break the nocturnal brief.
 *
 * Scope note: the `bg-cta-primary`-style Tailwind utilities are NOT bound to `--text-on-cta`,
 * because they currently paint no background at all (Tailwind v3 `<alpha-value>` syntax in a
 * v4 `@theme` — atlas-e2e TASK-4949). They must move to it when that is fixed. The rows below
 * describe the token this palette actually declares and the components actually consume.
 *   --text-primary   (#f5f0e6) / --bg-primary   (#0b0d12)  → 17.11:1
 *   --text-secondary (#c9c2b3) / --bg-primary   (#0b0d12)  → 10.97:1
 *   --text-muted     (#9a9282) / --bg-primary   (#0b0d12)  →  6.30:1
 *   --text-body      (#f5f0e6) / --bg-card      (#171a22)  → 15.31:1
 *   --brand-primary  (#d4af37) / --bg-primary   (#0b0d12)  →  9.24:1  (gold accent text/links)
 *   --brand-accent   (#f0c869) / --bg-primary   (#0b0d12)  → 12.19:1
 *   --text-on-cta    (#0b0d12) / --cta-primary  (#d4af37)  →  9.24:1  (gold CTA button label)
 *   --text-on-cta    (#0b0d12) / --cta-primary-hover (#c19a2c) → 7.34:1
 *   --text-on-cta    (#0b0d12) / --cta-secondary (#8f7c4a) →  4.77:1  (.rb-button gradient end)
 *   --accent-text    (#f0c869) / --bg-muted     (#1c2029)  → 10.23:1  (worst of five surfaces)
 *   --lavender-text  (#c9c2b3) / --bg-muted     (#1c2029)  →  9.20:1  (worst of five surfaces)
 *   util-bar text    (#cbb89b) / --brand-ink    (#14171f)  →  9.27:1
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
  // On-CTA label colour (see base.css's `--text-on-cta` comment). noir is the reason this
  // token exists: it is the only layout whose CTA fill is LIGHTER than its page background,
  // so the inherited #ffffff default rendered 2.10:1 on gold. Near-black instead — the same
  // hex as `--bg-primary`, keeping the nocturnal brief intact rather than lightening the gold.
  // 9.24:1 on `--cta-primary`, 7.34:1 on `--cta-primary-hover`, 4.77:1 on `--cta-secondary`.
  "--text-on-cta": "#0b0d12",
  "--cta-primary-rgb": "212 175 55",
  "--cta-primary-hover-rgb": "193 154 44",
  "--cta-secondary-rgb": "143 124 74",

  "--text-primary": "#f5f0e6",
  "--text-secondary": "#c9c2b3",
  "--text-muted": "#9a9282",
  "--text-body": "#f5f0e6",
  "--text-on-hero": "#ffffff",

  // Small-accent TEXT roles. `base.css` defaults these to a coral/violet pair chosen for LIGHT
  // surfaces (#a84832 / #6f5aa8) and explicitly asks every theme to override with its own
  // brand-matched passing values — noir never did, so on its dark surfaces they measured
  // 2.82-3.43:1 (worst case `--bg-muted`), under the 4.5:1 floor. Caught rendering live on the
  // search widget's "1 night" chip at 2.82:1. Both reuse hexes already in this palette:
  //   --accent-text   (#f0c869 = --brand-accent)   → 10.23:1 worst-case across all five surfaces
  //   --lavender-text (#c9c2b3 = --text-secondary) →  9.20:1 worst-case
  // noir collapses the coral/violet accent axis onto its gold-and-stone register, consistent
  // with how `--romance-soft`/`--accent-soft` already both resolve to the same gold tint above.
  "--accent-text": "#f0c869",
  "--lavender-text": "#c9c2b3",

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
  // `--brand-ink` reads like "ink for the brand surface" (i.e. light, on noir's dark chrome),
  // and this palette originally set it that way — but it has exactly ONE consumer in the repo,
  // `navbar.css`'s `.util-bar`, which uses it as the BACKGROUND of a "slim dark strip" and pairs
  // it with hardcoded warm-light text (#cbb89b / #ffe8d6). The light cream therefore rendered
  // light-on-light: 1.70:1 and 1.04:1, caught by an axe run against `/?layout=noir`. Every other
  // palette sets this dark (base #1f2c45, coastal #082f3a, editorial #1f1b16, heritage #1a1a2e,
  // photoFirst #111111); noir was the lone outlier. `--bg-secondary`'s hex keeps the strip
  // slightly lifted off `--bg-primary`: 9.27:1 and 15.16:1 against that pair.
  "--brand-ink": "#14171f",
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
