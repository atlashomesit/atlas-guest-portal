/**
 * TASK-4925 / ADR-0081 D5/D6b/D8 — "photoFirst" layout's own authored default color palette.
 *
 * Founder-specified visual direction (epic §2/§3.1, ADR-0081 D8, ATLAS-DEVELOPER-TASKS.md
 * TASK-4925): "minimal photo-first" — near-zero chrome (minimal nav/borders/decorative UI),
 * huge full-bleed photography as the primary content, a sticky booking bar rather than an
 * inline/hero widget. The palette below is deliberately near-monochrome (ink/paper) so it
 * never competes with tenant photography for attention.
 *
 * Painted when `effectiveColorPresetId` resolves to `null` (D6b — no tenant-chosen or seasonal
 * color preset applies). Mirrors `noir/defaultColorTokens.ts`/`coastal/defaultColorTokens.ts`'s
 * shape/keys exactly (TASK-4906/4907 precedent) so the same CSS-variable surface every shared
 * component already reads works unchanged for this layout too. Runtime application (painting
 * these onto `document.documentElement` when the resolved layout is `photoFirst` and no preset
 * is active) is TASK-4904's boot-wiring scope, not invented here — same "data only" note as
 * heritage/noir/coastal's files.
 *
 * WCAG AA contrast (computed via the standard relative-luminance formula, not eyeballed —
 * TASK-4925's hard bar, epic §3.11/AC14/AC15). Ratios for every text/background pair this
 * palette actually binds to in `Home.tsx`/`StickyBookingBar.tsx`/`PhotoFirstListingsStack.tsx`:
 *   --text-primary   (#111111) / --bg-primary   (#ffffff)  → 18.88:1
 *   --text-secondary (#4a4a48) / --bg-primary   (#ffffff)  →  8.88:1
 *   --text-muted     (#6b6b68) / --bg-primary   (#ffffff)  →  5.35:1
 *   --text-primary   (#111111) / --bg-secondary (#f7f7f5)  → 17.60:1
 *   --text-secondary (#4a4a48) / --bg-secondary (#f7f7f5)  →  8.28:1
 *   white button text (#ffffff) / --cta-primary  (#111111) → 18.88:1  (sticky-bar CTA)
 *   white button text (#ffffff) / --cta-primary-hover (#2b2b2b) → 14.16:1
 *   --support-success (#2f7d4f) / --bg-primary   (#ffffff) →  5.04:1
 *   --support-danger  (#b3261e) / --bg-primary   (#ffffff) →  6.54:1
 *   --footer-text     (#d8d6d0) / --footer-bg    (#111111) → 12.99:1
 *   --footer-link     (#b8b6b0) / --footer-bg    (#111111) →  9.31:1
 *   --border-strong   (#7d7b75) / --bg-primary   (#ffffff) →  4.23:1  (UI-component threshold,
 *                                                                       not text — 3:1 per WCAG
 *                                                                       1.4.11 non-text contrast,
 *                                                                       cleared with margin)
 *   hero/stack caption white text (#ffffff) on the bottom-scrim gradient — verified against a
 *   worst-case pure-white tenant photo behind the scrim (deterministic regardless of actual
 *   photo content, per this task's stop-and-ask): at the gradient's 92%-opacity stop the
 *   blended surface is ~#1e1e1e → 16.67:1; even at the softer 55%-opacity stop it is ~#787878
 *   → 4.42:1. Hero/caption text is positioned only within the ≥80%-opacity band of the scrim
 *   (`Home.css`/`PhotoFirstListingsStack` — see their scrim gradient stops), so real placement
 *   always clears 4.5:1 regardless of the uploaded photo's brightness.
 * All normal-text pairs clear the 4.5:1 AA threshold with margin; `--border-subtle` is
 * decorative-only (never bound to text or a meaningful UI boundary) and is not held to a
 * contrast minimum, same convention as every other palette in this registry/`themeRegistry`.
 */
export const photoFirstDefaultColorTokens: Readonly<Record<string, string>> = {
  "--bg-primary": "#ffffff",
  "--bg-secondary": "#f7f7f5",
  "--bg-card": "#ffffff",
  "--bg-surface": "#fafaf9",
  "--bg-muted": "#f0efec",

  "--brand-primary": "#111111",
  "--brand-accent": "#2b2b2b",
  "--brand-soft": "#f0efec",
  "--accent-primary": "#111111",
  "--accent-soft": "#f0efec",
  "--romance-soft": "#f0efec",
  "--accent-primary-rgb": "17 17 17",
  "--accent-soft-rgb": "240 239 236",

  "--cta-primary": "#111111",
  "--cta-primary-hover": "#2b2b2b",
  "--cta-secondary": "#4a4a48",
  "--cta-primary-rgb": "17 17 17",
  "--cta-primary-hover-rgb": "43 43 43",
  "--cta-secondary-rgb": "74 74 72",

  "--text-primary": "#111111",
  "--text-secondary": "#4a4a48",
  "--text-muted": "#6b6b68",
  "--text-body": "#111111",
  "--text-on-hero": "#ffffff",

  "--success": "#2f7d4f",
  "--support-success": "#2f7d4f",
  "--support-danger": "#b3261e",
  "--support-error": "#b3261e",
  "--border": "#e5e4e0",
  "--border-subtle": "#e5e4e0",
  "--border-strong": "#7d7b75",

  "--gradient-hero": "linear-gradient(135deg, #ffffff 0%, #f7f7f5 50%, #f0efec 100%)",
  "--gradient-cta": "linear-gradient(135deg, #111111, #2b2b2b)",
  "--gradient-card": "linear-gradient(180deg, rgba(17, 17, 17, 0.04) 0%, transparent 100%)",

  "--brand": "#111111",
  "--brand-ink": "#111111",
  "--brand-contrast": "#ffffff",

  "--footer-bg": "#111111",
  "--footer-text": "#d8d6d0",
  "--footer-heading": "#ffffff",
  "--footer-link": "#b8b6b0",
  "--footer-link-hover": "#ffffff",

  "--shadow-level-1": "0 2px 8px rgba(17, 17, 17, 0.05), 0 1px 3px rgba(17, 17, 17, 0.03)",
  "--shadow-level-2": "0 8px 24px rgba(17, 17, 17, 0.08), 0 4px 12px rgba(17, 17, 17, 0.04)",
  "--shadow-level-3": "0 24px 72px rgba(17, 17, 17, 0.10), 0 12px 32px rgba(17, 17, 17, 0.05)",
  "--shadow-1": "var(--shadow-level-1)",
  "--shadow-2": "var(--shadow-level-2)",
  "--shadow-3": "var(--shadow-level-3)",
};
