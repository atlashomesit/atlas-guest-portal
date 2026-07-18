# Theme Switching Guide

## How to switch themes (runtime)
- Use the dev-only floating selector (appears in development builds) to change themes at runtime without layout shift.
- Programmatically: call `applyTheme("<themeName>")` or use `useTheme()` from `ThemeProvider` and call `setTheme("<themeName>")`.
- Default theme remains `default` (Premium Platinum).

## Where themes are defined
- Registry: `src/styles/theme.ts` (`themeRegistry`, `availableThemes`)
- Tokens (CSS variables): `src/styles/themes/*.css`
- Imports: `src/styles/themes/index.css`
- TS theme list: `src/theme/themes.ts`

## How to add a new theme
1) Create a CSS file in `src/styles/themes/your-theme.css` defining `:root[data-theme="yourThemeName"]` variables (colors, typography, borders, shadows, motion).
2) Import it in `src/styles/themes/index.css`.
3) Add entry to `themeRegistry` in `src/styles/theme.ts` (label + description).
4) Optionally add to `themeOptions` in `src/theme/themes.ts` if you want it selectable in dev switcher.

## Theme Provider
- Location: `src/theme/ThemeProvider.tsx`
- Props: `initialTheme?`, `enableDevSwitcher?` (dev-only overlay)
- Provides `useTheme()` with `{ theme, setTheme }`.
- Stub ready for future persistence (front office toggle).

### Dev switcher persistence (DEV builds only)
Picking a theme in the floating switcher writes two localStorage keys:

| Key | Value |
| --- | --- |
| `atlas-dev-theme` | the chosen theme name |
| `atlas-dev-theme-explicit` | `"true"` — marks it as a deliberate developer choice |

The stored theme is re-applied on later loads **only while the marker is present**. Nothing is
written until you actually pick a theme, so by default every load follows `initialTheme` — the
tenant's server-resolved `effectiveColorPresetId` (see `src/main.tsx`). To stop pinning a theme
and go back to following the tenant, clear `atlas-dev-theme-explicit` (or use a fresh profile).

Without that gate, the switcher's remembered value shadowed the tenant's real preset on every
subsequent load — browse tenant A then tenant B and B rendered A's palette.

## Added premium themes
- `privateIslandNoir`: nocturnal island luxe with gold accents, candlelit mood.
- `jetsetPearl`: pearl-white with rose-gold sunrise, glassy + airy feel.
- `ultraYachtAzure`: superyacht Monaco elegance with sapphire sea and silver accents.
- `loversRetreatBlush`: honeymoon suite warmth with champagne gold and blush rose.
- `emeraldDynasty`: royal dark emerald palace with elite gold accents.
- `auroraChampagne`: dreamy champagne penthouse sunrise with glassy glow.

