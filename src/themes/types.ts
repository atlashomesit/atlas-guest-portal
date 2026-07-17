/**
 * TASK-4903 / ADR-0081 (D1, D5, D6) — shared types for the layout-theme registry.
 *
 * A "layout theme" is a self-contained page-template package (home, listing detail,
 * gallery, about, contact) built from the shared component library (`@/components`,
 * `@/lib`, `@/api`, `@/tenant`). It is selected independently of the "color preset"
 * axis (`@/styles/theme.ts`'s `themeRegistry`) — see `supportedColorPresets` below.
 *
 * Theme ≠ integration (AGENTS.md HARD RULE): a `LayoutThemeModule` may only compose
 * existing shared primitives. It must never duplicate booking/payment/listing-data
 * logic, and no module outside `src/themes/` may import from `src/themes/` except
 * the mount points (`src/App.tsx` / `src/main.tsx`) — enforced by the ESLint
 * boundary rule in `eslint.config.js`.
 */
import type { ComponentType } from "react";
import type { ThemeName } from "@/styles/theme";

/**
 * The page-level components every layout theme must export. Mirrors the epic's
 * §3.1 registry comment ("layout entry: exports Home/ListingDetail/About/Gallery
 * page components") plus Contact, which ADR-0081 D1 also lists as a themed page.
 */
export interface LayoutThemeModule {
  Home: ComponentType;
  PropertyDetails: ComponentType;
  About: ComponentType;
  Gallery: ComponentType;
  Contact: ComponentType;
}

/**
 * Registered layout-theme IDs. Extend this union (and `registry.ts`'s
 * `themeRegistry` map) as each sibling task lands its own package —
 * TASK-4914 ("heritage"), TASK-4906 ("noir"), TASK-4907 ("coastal"),
 * TASK-4924 ("editorial"), TASK-4925 ("photoFirst").
 */
export type LayoutThemeId = "classic";

export interface LayoutThemeDefinition {
  id: LayoutThemeId;
  /** Human-readable label (e.g. for a future admin-portal theme picker — no self-service UI in v1). */
  label: string;
  description?: string;
  /** Lazy import of the theme package — evaluated once, on first render of a themed route (React.lazy semantics). */
  load: () => Promise<LayoutThemeModule>;
  /**
   * ADR-0081 D6 — the curated-matrix declaration: which color presets (from
   * `@/styles/theme.ts`'s `themeRegistry`) this layout has been authored/verified
   * to look coherent under. May be empty. A preset not in this list is never
   * selectable/renderable for this layout (safe no-op fallback, not an error).
   */
  supportedColorPresets: ThemeName[];
}
