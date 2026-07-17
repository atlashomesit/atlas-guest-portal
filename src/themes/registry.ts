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
