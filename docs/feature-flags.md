# Support drawer feature flags

The support drawer ships with feature flags that default **off** to keep production safe. Developers can temporarily enable the stubbed UX variations via query parameters or localStorage without touching code.

## Available flags

Use the `ff` override tokens listed below. Each token maps to a specific flag in `src/config/featureFlags.ts`:

- `compactDrawer` → `enableCompactDrawer`
- `whatsappPrimary` → `enableRecommendedWhatsAppPrimary`
- `collapseSecondary` → `enableSecondaryActionsCollapsed`
- `revealCallback` → `enableRevealCallbackOnClickOnly`
- `hideChatbot` → `enableHideUnfinishedChatbot`
- `trustMicrocopy` → `enableTrustMicrocopy`
- `closeReassurance` → `enableCloseReassurance`
- `structureTokens` → `enableDrawerStructureTokens`

Other support drawer flags remain available in the codebase but are not currently overrideable by debug tokens.

## How overrides work

- Overrides are **ignored in production** unless an `ff` query parameter is present (safety-first default).
- In non-production builds (`npm run dev`), overrides from query parameters or `localStorage` are always honored.
- A small console log in development shows which flags are active.

## Enabling flags via query parameter

Append an `ff` query string with a comma-separated list of tokens:

- `http://localhost:5173/?ff=hideChatbot`
- `http://localhost:5173/?ff=hideChatbot,compactDrawer,whatsappPrimary`

## Enabling flags via localStorage

Set the `atlas_ff` key to a comma-separated list of tokens. For example, run this in the browser console while on the app:

```js
localStorage.setItem("atlas_ff", "compactDrawer,revealCallback");
```

Reload the page to apply the overrides. LocalStorage overrides are only read in development unless the page also has an `ff` query parameter (explicit opt-in for production).

## Drawer spacing tokens for visual tuning

Spacing inside the support drawer now comes from CSS custom properties so you can adjust it without changing JSX classes:

- `--drawer-card-padding-block`
- `--drawer-card-padding-inline`
- `--drawer-section-gap`

The defaults mirror the current layout (12px block padding, 16px inline padding, 12px gaps). To tweak them temporarily, set overrides on the drawer container in DevTools or apply inline styles when instantiating `SupportDrawer`. Keeping the `ff` tokens above off preserves the existing spacing and close control visuals; enable the `structureTokens` flag when you want to drive those values from CSS variables without changing default spacing.
