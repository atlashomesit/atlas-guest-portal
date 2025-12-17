# Design system foundation

Our design system keeps the UI calm and premium while staying accessible. Tokens live in CSS variables within `src/styles/theme.css` and are mirrored as TypeScript references in `src/styles/theme.ts`.

## Tokens

- **Colors:** background/surface, muted surface, primary (`--color-primary`), primary strong, accent, ink/ink-subtle, border/border-strong, success, danger.
- **Typography:** `--font-family-base`, `--font-family-display`, font sizes from `--font-size-xs` through `--font-size-3xl`, and line heights for tight/snug/relaxed.
- **Spacing:** `--space-1` (4px) through `--space-8` (32px).
- **Radius:** `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`.
- **Shadows:** `--shadow-soft`, `--shadow-strong`.

Use the `designTokens` export from `src/styles/theme.ts` when you need the token name in code, and rely on CSS variables directly in styles.

## Shared components

Each UI primitive reads from the shared tokens (see `src/components/ui/ui.css`):

- **Button:** primary (default), secondary, and ghost variants with optional `size` (`sm`, `md`, `lg`) and `fullWidth`. Import from `src/components/ui/Button`.
- **Input:** unified styling for `input`, `select`, and `textarea` via the `as` prop; defaults to full width. Import from `src/components/ui/Input`.
- **Card:** elevated surface with rounded corners; set `muted` for a soft gradient background. Import from `src/components/ui/Card`.
- **Typography:** semantic text with variants `h1`, `h2`, `h3`, `subtitle`, `body`, and `muted`. Import from `src/components/ui/Typography`.

## Usage guidelines

1. Prefer these shared components for new UI to keep spacing, radii, and typography consistent.
2. Keep contrast high: primary and accent colors meet WCAG AA on light surfaces; use `--color-ink` for text on light backgrounds.
3. Avoid hardcoding colors in new components—reference tokens or existing utility classes that already map to the palette.
4. When integrating with routing or external links, wrap buttons with anchors only when necessary to retain semantics.
5. Do not hardcode domains (www/dev). Always derive base URL from `window.location.origin` or environment config.
