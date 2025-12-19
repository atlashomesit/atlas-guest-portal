# Design system and theming guide

Our design system keeps the UI calm, premium, and accessible. Tokens live as CSS variables in `src/styles/themes/*.css` and are mirrored in TypeScript as `designTokens` (`src/styles/theme.ts`). The active palette is selected via `data-theme` on `<html>`, letting seasonal themes override variables without touching component code.

## Semantic token set

- **Surfaces:** `--bg-primary` (page background), `--bg-surface` (cards and panels), `--bg-muted` (stripes/section bands).
- **Text:** `--text-primary` (body + headings), `--text-muted` (supporting copy and labels).
- **Accent:** `--accent-primary` (links, focus rings, highlights), `--accent-soft` (blush/halo fills for chips, subtle dividers). Avoid using accent for primary booking actions.
- **CTA:** `--cta-primary` (book/submit actions), `--cta-secondary` (quiet alternatives such as “Save for later”). CTAs intentionally differ from accent to keep booking intent obvious.
- **Borders:** `--border-subtle` (card outlines/dividers), `--border-strong` (inputs, alerts, emphasized frames).
- **State:** `--support-success`, `--support-danger` for confirmations and errors.
- **Typography:** `--font-family-base`, `--font-family-display`, sizes `--font-size-xs`→`--font-size-3xl`, and line heights `--line-height-tight|snug|relaxed`.
- **Spacing:** `--space-1`→`--space-8` (4–32px scale). Use multiples to align grid rhythm.
- **Radius:** `--radius-sm|md|lg|pill` for inputs, cards, and pills.
- **Shadows:** `--shadow-level-1|2` for elevation.
- **Layers:** `--z-base|dropdown|sticky|floating|overlay|modal|toast` define the z-index ladder—do not invent one-off values.
- **Safe areas:** `--safe-area-top|right|bottom|left` mirror device insets (e.g., notches) for padding calculations.

Use `designTokens` when consuming tokens in TypeScript or CSS-in-JS; otherwise, reference the CSS variables directly in stylesheets.

### Default palette intent

`default` is the calm baseline: warm parchment surfaces, deep navy text, teal CTAs, and airy shadows. Seasonal themes (Valentine, Christmas, New Year) remix accent and CTA hues but keep semantic roles. Treat `accent-soft` as blush—not a text color or CTA fill.

## Usage rules and do/don’t examples

1. Prefer shared components (`src/components/ui/*`) so spacing, radius, and typography stay consistent.
2. Keep contrast high; use `--text-primary` on light surfaces and ensure CTA text meets AA on its fill.
3. Never hardcode marketing palettes into bespoke buttons. Use CTA tokens for booking flows.
4. Accent is for highlights (links, focus rings, chips). CTA colors are for actions that commit or advance.
5. Blush (`--accent-soft`) is for low-emphasis fills; avoid pairing it with muted text for required fields or primary actions.

**Do:**
```tsx
<Button variant="primary">Book now</Button> // uses --cta-primary
```

**Don’t:**
```tsx
<Button style={{ background: "var(--accent-primary)" }}>Book now</Button> // romantic accent on booking CTA
```

For secondary CTAs (e.g., “Talk to host”), prefer the Button `secondary` variant or `--cta-secondary`; reserve ghost/tertiary treatments for non-blocking actions.

## Theming, switching, and overrides

- Shared base tokens: `src/styles/themes/base.css` (typography, spacing, radii, safe areas, z-index scale).
- Theme palettes: `src/styles/themes/<theme>.css` with semantic overrides scoped by `data-theme="<theme>"`.
- Registration: add the key to `themeRegistry` and `availableThemes` in `src/styles/theme.ts`.
- Bundling: import the new file in `src/styles/themes/index.css` so Vite includes the variables.
- Switching: call `applyTheme(themeKey)`; it guards unknown keys and falls back to `default`.

### Adding a new seasonal theme safely

1. Copy `src/styles/themes/default.css` to `src/styles/themes/<name>.css` and adjust semantic values only (no new variable names).
2. Add the theme to `themeRegistry` in `src/styles/theme.ts` and import it in `src/styles/themes/index.css`.
3. Avoid reassigning semantics: keep CTA hues distinct from accent. Romantic or festive palettes should not make booking CTAs look like decorative links.
4. Validate contrast for text on CTA fills and accents.
5. Keep shadows subtle; do not exceed the existing `--shadow-level-2` strength.

## Governance for layers and safe areas

- **Z-index:** use the provided ladder (`base` < `dropdown` < `sticky` < `floating` < `overlay` < `modal` < `toast`). If a new layer is needed, extend the scale in `base.css` rather than sprinkling numeric literals.
- **Safe areas:** pad sticky headers/footers with `var(--safe-area-*)` to avoid notches and home indicators. Avoid hardcoded `env()` calls; rely on the tokens so themes can mock insets for testing.

## Theme QA checklist

- CTAs use `--cta-primary`/`--cta-secondary`; no accent color on booking CTAs.
- Text and interactive elements pass contrast on `--bg-primary` and `--bg-surface`.
- Focus rings use `--accent-primary`; ensure visibility on both light and dark palettes.
- Borders and dividers use `--border-subtle`/`--border-strong`; no ad-hoc hex codes.
- Safe-area padding is respected on sticky nav/footers and floating toasts.
- Z-index ordering follows the scale; dropdowns should not overlay modals/toasts unless explicitly elevated.
- Shadows remain within `--shadow-level-1|2` strength and match the palette’s hue/opacity.
