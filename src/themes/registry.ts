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
import type { LayoutThemeDefinition, LayoutThemeId, LayoutThemeModule } from "./types";
import { heritageDefaultColorTokens } from "./heritage/defaultColorTokens";
import { coastalDefaultColorTokens } from "./coastal/defaultColorTokens";

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
