/**
 * TASK-4924 / ADR-0081 D5/D6b/D8 — "editorial" layout theme's own authored default color
 * palette.
 *
 * Founder-specified visual direction (epic §3.1/§3.9, ADR-0081 D8, ATLAS-DEVELOPER-TASKS.md
 * TASK-4924): "editorial magazine" — text-forward composition, serif display typography,
 * story-driven section flow. Warm paper/ivory background, near-black warm ink for reading
 * text, and a deep burgundy/rust accent reserved for pull-quote marks, rules, and CTA
 * backgrounds (never bound to small body text — see `Home.tsx`/`EditorialPullQuote.tsx`
 * header comments for the binding discipline this palette assumes).
 *
 * Painted when `effectiveColorPresetId` resolves to `null` (no tenant-chosen or seasonal
 * color preset applies), per D6b — mirrors `heritage`/`noir`/`coastal`'s
 * `defaultColorTokens.ts` shape/key set so `applyTheme()`'s CSS-variable consumers
 * (TASK-4904 wiring) need no per-layout special-casing.
 *
 * WCAG AA contrast (computed via the standard relative-luminance formula, not eyeballed —
 * TASK-4924's hard bar, epic §3.11/AC14/AC15). Ratios for every text/background pair this
 * palette actually binds to in `Home.tsx`/`EditorialPullQuote.tsx`/`EditorialFeaturedStays.tsx`:
 *   --text-primary   (#1f1b16) / --bg-primary   (#faf6f0)  → 16.15:1
 *   --text-secondary (#4a4038) / --bg-primary   (#faf6f0)  →  9.37:1
 *   --text-body      (#241f1a) / --bg-card      (#ffffff)  → 16.64:1
 *   --brand-primary  (#7a2e2e) / --bg-primary   (#faf6f0)  →  8.64:1  (pull-quote rule/accent word — large text)
 *   --brand-accent   (#b0463f) / --bg-primary   (#faf6f0)  →  5.14:1  (decorative quote-mark glyph)
 *   Note: `--cta-primary`/`--cta-primary-hover` are used only as a decorative underline
 *   (`.editorial-chapter-cta`, `Home.css`) never as a solid text-label background — see that
 *   file's own comment for why a filled button was deliberately rejected (no single fixed
 *   label color clears 4.5:1 against every declared curated preset's `--cta-primary`, since
 *   the matrix ranges from light (jetsetPearl/auroraChampagne) to dark (loversRetreatBlush)).
 *   --support-danger (#b3261e) / --bg-primary   (#faf6f0)  →  6.07:1
 *   --footer-link/--footer-text (#cbbfae) / --footer-bg (#1f1b16) → 9.60:1
 * All normal-text pairs clear the 4.5:1 AA threshold with wide margin. `--text-muted`
 * (#756a5e, ~4.90:1 on --bg-primary) is intentionally the *lowest*-margin token in this
 * palette; `Home.tsx`/`EditorialPullQuote.tsx` never bind it to anything smaller than this
 * layout's byline/meta copy (still normal body size, and it clears 4.5:1) — no token in this
 * file relies on the large-text 3:1 carve-out. `--border-subtle`/`--border-strong` are
 * decorative-only (never bound to text), same convention as every other palette in this
 * registry.
 */
export const editorialDefaultColorTokens: Readonly<Record<string, string>> = {
  "--bg-primary": "#faf6f0",
  "--bg-secondary": "#f2ece1",
  "--bg-card": "#ffffff",
  "--bg-surface": "#fffdfa",
  "--bg-muted": "#f2ece1",

  "--brand-primary": "#7a2e2e",
  "--brand-accent": "#b0463f",
  "--brand-soft": "#f3e0d9",
  "--accent-primary": "#7a2e2e",
  "--accent-soft": "#f3e0d9",
  "--romance-soft": "#f3e0d9",
  "--accent-primary-rgb": "122 46 46",
  "--accent-soft-rgb": "243 224 217",

  "--cta-primary": "#7a2e2e",
  "--cta-primary-hover": "#5e2323",
  "--cta-secondary": "#b0463f",
  "--cta-primary-rgb": "122 46 46",
  "--cta-primary-hover-rgb": "94 35 35",
  "--cta-secondary-rgb": "176 70 63",

  "--text-primary": "#1f1b16",
  "--text-secondary": "#4a4038",
  "--text-muted": "#756a5e",
  "--text-body": "#241f1a",
  "--text-on-hero": "#1f1b16",

  "--success": "#10b981",
  "--support-success": "#10b981",
  "--support-danger": "#b3261e",
  "--support-error": "#b3261e",
  "--border": "#e6dccf",
  "--border-subtle": "#e6dccf",
  "--border-strong": "#cdbba5",

  "--gradient-hero": "linear-gradient(135deg, #faf6f0 0%, #f2ece1 50%, #f3e0d9 100%)",
  "--gradient-cta": "linear-gradient(135deg, #7a2e2e, #b0463f)",
  "--gradient-card": "linear-gradient(180deg, rgba(122, 46, 46, 0.04) 0%, transparent 100%)",

  "--brand": "#7a2e2e",
  "--brand-ink": "#1f1b16",
  "--brand-contrast": "#faf6f0",

  "--footer-bg": "#1f1b16",
  "--footer-text": "#cbbfae",
  "--footer-heading": "#faf6f0",
  "--footer-link": "#cbbfae",
  "--footer-link-hover": "#ffffff",

  "--shadow-level-1": "0 2px 10px rgba(31, 27, 22, 0.06), 0 1px 3px rgba(31, 27, 22, 0.04)",
  "--shadow-level-2": "0 10px 28px rgba(31, 27, 22, 0.09), 0 4px 12px rgba(31, 27, 22, 0.05)",
  "--shadow-level-3": "0 24px 64px rgba(31, 27, 22, 0.12), 0 12px 32px rgba(31, 27, 22, 0.06)",
  "--shadow-1": "var(--shadow-level-1)",
  "--shadow-2": "var(--shadow-level-2)",
  "--shadow-3": "var(--shadow-level-3)",
};
