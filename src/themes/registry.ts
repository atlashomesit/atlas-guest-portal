/**
 * TASK-4903 / ADR-0081 (D1, D2, D5, D6) — layout-theme registry.
 *
 * Single source of truth for "which layout-theme IDs exist" (epic §3.1). Mirrors the
 * existing per-route `React.lazy()` pattern in `src/App.tsx`, applied one level up: a
 * whole theme package (all its pages) is one lazy-loaded Vite chunk, selected at boot
 * by the tenant's resolved `effectiveThemeId` (TASK-4904; stubbed to `classic` until
 * that lands — see `getCurrentLayoutThemeId()`/`setCurrentLayoutThemeId()` below).
 *
 * This is the ONLY file (besides each theme's own `index.tsx`) that `src/App.tsx` /
 * `src/main.tsx` are allowed to import from `src/themes/` — see the ESLint boundary
 * rule in `eslint.config.js` and the HARD RULE in `AGENTS.md` ("Theme ≠ integration").
 */
import type { ThemeName } from "@/styles/theme";
import type { LayoutThemeDefinition, LayoutThemeId, LayoutThemeModule } from "./types";
import { heritageDefaultColorTokens } from "./heritage/defaultColorTokens";
import { noirDefaultColorTokens } from "./noir/defaultColorTokens";
import { coastalDefaultColorTokens } from "./coastal/defaultColorTokens";
import { editorialDefaultColorTokens } from "./editorial/defaultColorTokens";
import { photoFirstDefaultColorTokens } from "./photoFirst/defaultColorTokens";

export const DEFAULT_LAYOUT_THEME_ID: LayoutThemeId = "classic";

export const themeRegistry: Record<LayoutThemeId, LayoutThemeDefinition> = {
  classic: {
    id: "classic",
    label: "Sandstone Coral (Classic)",
    description:
      "The current Atlas guest-portal look — cream/coral/lavender palette, the free default layout for every tenant.",
    load: () => import("./classic"),
    // Implementation judgment call (task text, TASK-4903): a reasonable starting set for
    // the coral layout — `default` plus the four "Light Vibrant" presets (sunriseCoral/
    // oceanLuxury/emeraldOasis/royalViolet), which already share classic's light, airy
    // aesthetic, plus the three seasonal presets (any layout may opt into seasonal
    // auto-apply, ADR-0081 D7). The darker/premium presets (privateIslandNoir, jetsetPearl,
    // ultraYachtAzure, loversRetreatBlush, emeraldDynasty, auroraChampagne) are left
    // undeclared here — they read as mismatched against classic's light coral layout and
    // are reserved as natural candidates for the upcoming premium layouts (noir/coastal/
    // etc., TASK-4906/4907/4914/4924/4925) to curate for themselves. Not founder-dictated;
    // revisit per-layout as those tasks land.
    supportedColorPresets: [
      "default",
      "sunriseCoral",
      "oceanLuxury",
      "emeraldOasis",
      "royalViolet",
      "valentine",
      "christmas",
      "newYear",
    ],
  },
  heritage: {
    id: "heritage",
    label: "Heritage (Pre-Coral Atlas)",
    description:
      "The Atlas guest-portal look preserved from before the Sandstone Coral re-theme (d1ab2590^) — " +
      "warm ivory, deep coral/amber accents, deep-navy text. Recovered so Atlas (or any tenant) can " +
      "switch back to it with a single WebsiteThemeId flip (ADR-0081 amendment 2026-07-17 pt.4, TASK-4914).",
    load: () => import("./heritage"),
    // ADR-0081 D6 — heritage does not opt into any of the 14 shared color presets; it ships
    // its own baked default palette instead (`defaultColorTokens` below), recovered verbatim
    // from the pre-coral `default.css`. Empty is an explicitly allowed declaration (D6's own
    // text: "may be empty"), not an oversight — revisit if/when a specific preset is verified
    // to look coherent against heritage's warmer, deeper palette.
    supportedColorPresets: [],
    defaultColorTokens: heritageDefaultColorTokens,
  },
  noir: {
    id: "noir",
    label: "Dark Luxury Noir",
    description:
      "Nocturnal palette, gold accents, full-bleed imagery, minimal chrome — a moodier, " +
      "high-end night-stay register (TASK-4906, ADR-0081 D8).",
    load: () => import("./noir"),
    // ADR-0081 D6 curated matrix — the founder-approved list for noir explicitly names
    // privateIslandNoir/emeraldDynasty (epic §3.1) as coherent dark/jewel-toned presets;
    // both verified dark (bg-primary #0b0c10 / #04120b), gold-accented, and AA-passing
    // (>=6.3:1 on every text/bg pair actually rendered — see defaultColorTokens.ts's
    // in-line contrast table for noir's own default palette, computed the same way).
    //
    // CORRECTION (2026-07-18): that ">=6.3:1 on every text/bg pair actually rendered" claim
    // did NOT hold once the palettes were actually painted — noir's gold `--cta-primary`
    // (#d4af37) rendered white button labels at 2.10:1, the exact decorative-token-bound-to-
    // text failure mode `photoFirst`'s comment below already documents for jetsetPearl/
    // auroraChampagne. Root cause was a missing on-CTA label token, now added
    // (`--text-on-cta`, see `base.css` and `noir/defaultColorTokens.ts`).
    //
    // Re-checking the two curated presets above found the SAME defect in both — each ships a
    // gold `--cta-primary` (#c29b2f) whose white label measures 2.62:1 (hover 3.73/3.53:1,
    // `--cta-secondary` 4.08/4.15:1) — so the original claim was wrong for all three of noir's
    // palettes, not just its default. Both preset files now declare their own `--text-on-cta`
    // (see their in-line ratio notes). The claim holds again as written, for the default
    // palette and both curated presets; `cta-label-contrast.test.ts` now enforces it.
    // Light presets (jetsetPearl, loversRetreatBlush, auroraChampagne, the seasonal trio —
    // all light-background per their own CSS) read as mismatched against noir's dark
    // register and are deliberately left undeclared, same reasoning `classic`'s comment
    // above applies in reverse.
    supportedColorPresets: ["privateIslandNoir", "emeraldDynasty"],
    defaultColorTokens: noirDefaultColorTokens,
  },
  coastal: {
    id: "coastal",
    label: "Coastal Airy",
    description:
      "Light sea-blue palette, horizontal gallery listings, and wave-motif section dividers " +
      "— an airy register for beach/coastal-stay hosts (founder-specified, TASK-4907, ADR-0081 D8).",
    load: () => import("./coastal"),
    // ADR-0081 D6 curated-matrix declaration (task text, TASK-4907): a coherent, light/
    // blue-leaning subset of the 14 shared color presets — `oceanLuxury` ("airy aqua blues
    // for coastal stays") and `emeraldOasis` (fresh, light, beach-adjacent mint) both already
    // read as coastal-coherent by their own authored descriptions; `newYear` (light bg,
    // midnight-blue CTA) is included as a seasonal option that stays visually coherent with
    // the sea-blue register. `valentine`/`christmas` (warm rose/red-green) and the
    // dark/navy-premium presets (privateIslandNoir, jetsetPearl, ultraYachtAzure,
    // loversRetreatBlush, emeraldDynasty, auroraChampagne) are deliberately excluded — they
    // read as mismatched against this layout's light, airy brief (same judgment-call pattern
    // `classic`'s own registry comment already establishes). All three declared presets'
    // text/background pairs verified ≥4.5:1 AA (see PR description for the full ratio table).
    supportedColorPresets: ["oceanLuxury", "emeraldOasis", "newYear"],
    defaultColorTokens: coastalDefaultColorTokens,
  },
  editorial: {
    id: "editorial",
    label: "Editorial Magazine",
    description:
      "Text-forward composition, serif display typography, story-driven section flow — " +
      "the most structurally distinct layout in the lineup (founder-specified, TASK-4924, ADR-0081 D8).",
    load: () => import("./editorial"),
    // ADR-0081 D6 curated-matrix declaration (task text, TASK-4924): a coherent, warm/elegant
    // subset of the 14 shared color presets that reads as "editorial"/literary rather than
    // beachy (coastal), nocturnal (noir), or the coral default (classic). `loversRetreatBlush`
    // already authors a serif display font ("Cormorant Garamond") in its own CSS, the closest
    // built-in match to this layout's serif-typography brief; `auroraChampagne` and
    // `jetsetPearl` are both warm/pearl ivory-paper registers that read coherently against
    // this layout's paper/ink composition. The dark/nocturnal presets (privateIslandNoir,
    // emeraldDynasty), the sea-blue presets (oceanLuxury, emeraldOasis), ultraYachtAzure, and
    // the seasonal trio are deliberately excluded — they read as mismatched against this
    // layout's warm, literary register (same judgment-call pattern `noir`'s/`coastal`'s own
    // registry comments already establish).
    //
    // WCAG AA binding discipline (verified 2026-07-17, computed via the standard
    // relative-luminance formula — see `defaultColorTokens.ts`'s and `Home.css`'s own header
    // comments for the full reasoning): `Home.tsx`/`EditorialPullQuote.tsx`/
    // `EditorialFeaturedStays.tsx` bind ALL normal-text copy to `--text-primary`/`--text-body`
    // only, never to `--brand-primary`/`--cta-primary`/`--text-muted` (those are reserved for
    // borders, decorative rules, and `aria-hidden` decorative glyphs, which carry no
    // text-contrast requirement) — a deliberate, narrower binding discipline than
    // `coastal`'s, adopted specifically because this layout's curated presets span a much
    // wider brand-color lightness range (loversRetreatBlush's `--cta-primary` #a4545a is
    // fairly dark; jetsetPearl's/auroraChampagne's #d4a3a0/#d49a85 are both pale), so no
    // single fixed label/accent color could otherwise be guaranteed >=4.5:1 (body text) or
    // even >=3:1 (large text) against every declared preset's `--bg-primary`. Verified
    // `--text-primary`/`--text-body` ratios against each preset's own `--bg-primary`:
    //   loversRetreatBlush: #3d2e2a / #fdf8f5 -> 12.28:1; #524340 / #fdf8f5 -> 8.91:1
    //   auroraChampagne:    #3d342f / #fffdf9 -> 11.94:1; #5c524b / #fffdf9 ->  7.49:1
    //   jetsetPearl:        #2a2e32 / #f8f8f6 -> 12.86:1; #3a4046 / #f8f8f6 ->  9.86:1
    // All comfortably clear the 4.5:1 normal-text AA threshold. This layout's own authored
    // default palette's full ratio table lives in `defaultColorTokens.ts`.
    supportedColorPresets: ["loversRetreatBlush", "auroraChampagne", "jetsetPearl"],
    defaultColorTokens: editorialDefaultColorTokens,
  },
  photoFirst: {
    id: "photoFirst",
    label: "Minimal Photo-First",
    description:
      "Near-zero chrome, huge full-bleed photography, and a sticky booking bar — a " +
      "photography-led register for hosts whose property photos are the strongest sell " +
      "(TASK-4925, ADR-0081 D8).",
    load: () => import("./photoFirst"),
    // ADR-0081 D6 curated-matrix declaration: `oceanLuxury` and `royalViolet` are both light,
    // airy "Light Vibrant" presets whose own text/bg pairs are extremely high-contrast (dark
    // navy-on-ice-blue / near-black-on-lilac-white — see PR description for the full ratio
    // table) and whose CTA-button-on-white-text contrast clears 4.5:1 (4.87:1 / 7.02:1) —
    // verified deliberately, since two sibling "Premium" presets (jetsetPearl/auroraChampagne)
    // were checked and REJECTED here: their own --cta-primary is a pastel rose-gold whose
    // white-button-text contrast is ~2.2-2.4:1 (fails AA) and whose accent-as-link-text
    // contrast is ~2.1-2.4:1 (also fails) — the same decorative-token-bound-to-text failure
    // mode TASK-4923 root-caused for `classic`'s own default. Rather than ship a curated combo
    // this task can't verify passes (or silently work around the mismatch), those two presets
    // are left undeclared for this layout. `sunriseCoral`/`emeraldOasis` were also checked and
    // rejected for the same reason (their white-on-cta contrast is 3.15:1/3.77:1). Warmer/
    // saturated presets (the seasonal trio, the remaining seven) are deliberately excluded as
    // visually mismatched against this layout's neutral, photography-forward brief — same
    // judgment-call pattern every other layout's registry comment already establishes.
    supportedColorPresets: ["oceanLuxury", "royalViolet"],
    defaultColorTokens: photoFirstDefaultColorTokens,
  },
};

export const layoutThemeIds = Object.keys(themeRegistry) as LayoutThemeId[];

export function isRegisteredLayoutThemeId(id: string): id is LayoutThemeId {
  return id in themeRegistry;
}

/**
 * Resolves an arbitrary (possibly stale/typo'd/undefined) id to a registered layout-theme
 * id, falling back to the default — mirrors the existing `isRegisteredTheme()` fallback
 * pattern already proven in `src/styles/theme.ts` for the color-preset axis.
 */
export function resolveLayoutThemeId(id?: string | null): LayoutThemeId {
  if (id && isRegisteredLayoutThemeId(id)) return id;
  return DEFAULT_LAYOUT_THEME_ID;
}

/**
 * ADR-0081 D5/D6b — a layout's own authored default palette, or `undefined` when it has none
 * (`classic`, whose "default" look already ships as the `default` color preset's own CSS).
 */
export function getLayoutThemeDefaultColorTokens(
  id: LayoutThemeId,
): Readonly<Record<string, string>> | undefined {
  const definition = themeRegistry[id] ?? themeRegistry[DEFAULT_LAYOUT_THEME_ID];
  return definition.defaultColorTokens;
}

/**
 * ADR-0081 D6 — resolves a tenant's chosen color preset against the layout's curated matrix.
 *
 * Returns the preset only when this layout declares it in `supportedColorPresets`; otherwise
 * `null`, meaning "fall back to the layout's own `defaultColorTokens`". A preset that is
 * absent, unknown, or simply not curated for this layout is a safe no-op — D6's own wording:
 * "never selectable/renderable for this layout (safe no-op fallback, not an error)".
 */
export function resolveColorPresetForLayout(
  id: LayoutThemeId,
  colorPresetId?: string | null,
): ThemeName | null {
  if (!colorPresetId) return null;
  const definition = themeRegistry[id] ?? themeRegistry[DEFAULT_LAYOUT_THEME_ID];
  return definition.supportedColorPresets.includes(colorPresetId as ThemeName)
    ? (colorPresetId as ThemeName)
    : null;
}

/** Lazy-loads a layout theme's page-component module. Falls back to the default on an unregistered id. */
export function loadLayoutTheme(id: LayoutThemeId = DEFAULT_LAYOUT_THEME_ID): Promise<LayoutThemeModule> {
  const definition = themeRegistry[id] ?? themeRegistry[DEFAULT_LAYOUT_THEME_ID];
  return definition.load();
}

// ---------------------------------------------------------------------------------------
// Boot-resolved current layout theme (module-level singleton, set once at boot).
//
// `src/main.tsx` calls `setCurrentLayoutThemeId()` once tenant resolution completes
// (TASK-4903: stubbed to `effectiveThemeId ?? "classic"` since TASK-4904 hasn't landed
// the real DTO field yet — this already reads it defensively so no further wiring change
// is needed once TASK-4904 ships it). `src/App.tsx`'s themed routes read it lazily inside
// their `React.lazy()` loaders — safe because React only invokes a lazy loader on first
// render, which happens well after boot-time resolution has already run.
// ---------------------------------------------------------------------------------------
let currentLayoutThemeId: LayoutThemeId = DEFAULT_LAYOUT_THEME_ID;

export function setCurrentLayoutThemeId(id?: string | null): void {
  currentLayoutThemeId = resolveLayoutThemeId(id);
}

export function getCurrentLayoutThemeId(): LayoutThemeId {
  return currentLayoutThemeId;
}

/** Test-only: reset the boot-resolved theme id (module state outlives test files under isolate:false). */
export function _resetCurrentLayoutThemeIdForTests(): void {
  currentLayoutThemeId = DEFAULT_LAYOUT_THEME_ID;
}
