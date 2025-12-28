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

## Added premium themes
- `privateIslandNoir`: nocturnal island luxe with gold accents, candlelit mood.
- `jetsetPearl`: pearl-white with rose-gold sunrise, glassy + airy feel.
- `ultraYachtAzure`: superyacht Monaco elegance with sapphire sea and silver accents.
- `loversRetreatBlush`: honeymoon suite warmth with champagne gold and blush rose.
- `emeraldDynasty`: royal dark emerald palace with elite gold accents.
- `auroraChampagne`: dreamy champagne penthouse sunrise with glassy glow.

