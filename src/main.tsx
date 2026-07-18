import { createRoot } from 'react-dom/client'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import { DEFAULT_THEME, applyLayoutDefaultColorTokens, applyTheme } from './styles/theme'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import ApiConfigGuard from './components/ApiConfigGuard'
import { initMonitoring } from './lib/monitoring'
import { initAnalytics } from './utils/analytics'
import { ThemeProvider } from './theme/ThemeProvider'
import { loadRuntimeConfig, setRuntimeConfig, getApiBaseUrl } from './runtime-config'
import { getApiHeaders } from './api/client'
import { getTenantSlug, isAtlastaysMarketplaceSurface, isMarketplaceMode, setMarketplaceMode } from './tenant/tenantResolver'
import { validateTenant, resolveFromDomain, getTenantContext, SubdomainNotActivatedError, type TenantInfo } from './tenant/tenantContext'
import SubdomainNotActivatedScreen from './components/SubdomainNotActivatedScreen'
import { applyTenantBranding } from './tenant/tenantBranding'
import { ConfigLoadingScreen } from './runtime-config/ConfigLoadingScreen'
import { ConfigErrorScreen } from './runtime-config/ConfigErrorScreen'
import TenantJsonLd from './components/TenantJsonLd'
// TASK-4903 (ADR-0081): boot-time layout-theme resolution + prefetch. `src/App.tsx` is the
// only other mount point allowed to import `src/themes/registry` (ESLint boundary rule).
import {
  getLayoutThemeDefaultColorTokens,
  loadLayoutTheme,
  resolveColorPresetForLayout,
  resolveLayoutThemeId,
  setCurrentLayoutThemeId,
} from './themes/registry'

// Suppress chrome extension module loading errors in console (non-critical, expected in dev).
// ErrorEvent.message is typed `string` but is nullish for some cross-origin / platform error
// events (Sentry caught a TypeError here on dev). Treat both args as possibly nullish.
const isExtensionModuleError = (message?: string | null, filename?: string | null): boolean =>
  !!(message?.includes("Failed to fetch dynamically imported module") &&
     filename?.includes("chrome-extension://"));

window.addEventListener("error", (event) => {
  if (isExtensionModuleError(event.message, event.filename)) {
    event.preventDefault();
  }
}, true);

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || String(event.reason);
  if (isExtensionModuleError(message)) {
    event.preventDefault();
  }
}, true);

const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

/** Enable multi-tenant marketplace UI on atlastays.com apex (homepage + /search). */
function activateMarketplaceSurface(
  tenantKey: string | undefined,
  domainResolved: TenantInfo | null,
): void {
  if (!isAtlastaysMarketplaceSurface()) return
  const key = (tenantKey ?? '').trim().toLowerCase()
  if (
    domainResolved?.isMarketplaceRoot === true ||
    key === 'marketplace' ||
    key === 'marketplace-root'
  ) {
    setMarketplaceMode(true)
  }
}

/**
 * DEV-only layout override (`?layout=coastal`). TASK-4904's server-side `WebsiteThemeId` is the
 * real selection mechanism and there is deliberately no prod-facing layout picker (see the AC7
 * test's own note) — but until TASK-4904 lands there is otherwise NO way to exercise a
 * non-classic layout, or its baked `defaultColorTokens`, in a browser at all. Stripped from
 * production builds by the `import.meta.env.DEV` guard.
 */
const getDevLayoutThemeOverride = (): string | undefined => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get('layout') ?? undefined
}

const bootstrapApp = async () => {
  applyTheme(DEFAULT_THEME)
  initMonitoring()
  initAnalytics()
  window.addEventListener('atlas:cookie-consent-changed', () => {
    initAnalytics()
  })

  root.render(<ConfigLoadingScreen />)

  try {
    const config = await loadRuntimeConfig()
    setRuntimeConfig(config)
    const apiBaseUrl = getApiBaseUrl()
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'server'
    const envLabel = config.environment || 'unknown'

    if (import.meta.env.DEV) {
      console.info(
        `[startup] host=${hostname} env=${envLabel} apiBaseUrl=${apiBaseUrl}`,
      )
      if (!apiBaseUrl?.trim()) {
        console.error('[Atlas] DEV: apiBaseUrl is not set. Set apiBaseUrl in /.well-known/atlas-runtime-config.json (or runtime config).')
      }
      const headers = getApiHeaders()
      if (!headers['X-Tenant-Slug']) {
        console.warn('[Atlas] DEV: X-Tenant-Slug will not be sent (tenantKey in runtime config or hostname tenant). Tenant-scoped endpoints may return 400.')
      }
    }

    // 1. Try domain-based tenant resolution (white-label + default Atlas domains)
    //    Calls /tenants/from-domain?domain=<hostname> — no auth needed.
    //    Sets the resolved slug so all subsequent API calls use X-Tenant-Slug from context.
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    let domainResolved = null;
    try {
      domainResolved = domain ? await resolveFromDomain(apiBaseUrl, domain) : null;
    } catch (e) {
      // TASK-2642: the subdomain belongs to a tenant without the WEBSITE add-on. Render the
      // brand-neutral "not activated" page and STOP — do not fall back to validateTenant(),
      // which would leak Atlas branding onto a stranger's branded subdomain.
      if (e instanceof SubdomainNotActivatedError) {
        root.render(<SubdomainNotActivatedScreen />);
        return;
      }
      throw e;
    }

    if (!domainResolved) {
      // 2. Fall back to runtime config tenantKey (legacy / explicit override)
      const tenantSlug = getTenantSlug({ fallbackSlug: config.tenantKey });
      // Skip validateTenant for "marketplace" — it's not a real tenant, just a flag
      if (tenantSlug && tenantSlug !== 'marketplace') {
        try {
          await validateTenant(tenantSlug);
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('[Atlas] Tenant validation failed (dev — continuing):', e);
          } else {
            throw e;
          }
        }
      } else if (!import.meta.env.DEV && tenantSlug !== 'marketplace' && !isAtlastaysMarketplaceSurface()) {
        throw new Error('Tenant could not be resolved. Check /.well-known/atlas-runtime-config.json (tenantKey) or ensure the domain is registered in the Atlas tenant table.');
      }
    }

    activateMarketplaceSurface(config.tenantKey, domainResolved);

    // 3. Apply brand config to DOM (title, primaryColor CSS vars, favicon)
    const resolved = getTenantContext();
    if (isMarketplaceMode() && isAtlastaysMarketplaceSurface()) {
      // Marketplace apex uses Atlas Stays branding from static assets — not a single host tenant.
    } else if (resolved) {
      applyTenantBranding(resolved);
    }

    // TASK-4903 (ADR-0081 D2/D3/D5/D6a): resolve the layout-theme + color-preset axes once
    // tenant resolution completes. `resolved.effectiveThemeId`/`effectiveColorPresetId` are
    // undefined until TASK-4904 lands the server-side DTO fields — resolving here already
    // stubs "classic"/"default" in that case, so this wiring needs no further change once
    // TASK-4904 ships. Marketplace apex skips this — it isn't a single resolved tenant and
    // already renders with the boot-time DEFAULT_THEME applied above.
    const effectiveThemeId = resolveLayoutThemeId(getDevLayoutThemeOverride() ?? resolved?.effectiveThemeId)
    setCurrentLayoutThemeId(effectiveThemeId)
    let effectiveColorPreset = DEFAULT_THEME
    if (!(isMarketplaceMode() && isAtlastaysMarketplaceSurface())) {
      // ADR-0081 D5/D6b: install the layout's baked palette FIRST, then let `applyTheme()`
      // arbitrate — a preset this layout curates (D6) overrides the palette; no preset, or
      // one it does not curate, falls back to it. Before this wiring the layouts' authored
      // `defaultColorTokens` were dead data and every non-classic layout silently rendered
      // with classic's coral palette from `default.css`.
      //
      // Deliberately NOT gated on `resolved` being non-null: the palette is a property of the
      // resolved LAYOUT, not of the tenant record. Only the preset lookup below needs a tenant.
      applyLayoutDefaultColorTokens(effectiveThemeId, getLayoutThemeDefaultColorTokens(effectiveThemeId))
      effectiveColorPreset =
        resolveColorPresetForLayout(effectiveThemeId, resolved?.effectiveColorPresetId) ?? DEFAULT_THEME
      applyTheme(effectiveColorPreset)
    }

    // TASK-2400: `/` uses React.lazy (Home or MarketplaceHomepage). Under slow CDN or
    // parallel E2E load, the route chunk can still be loading after domcontentloaded —
    // body text stays tiny (Suspense fallback) and a11y/homepage tests flake. Prefetch
    // the correct root chunk during the intentional boot delay so first paint is ready.
    if (typeof window !== 'undefined') {
      if (isMarketplaceMode() && isAtlastaysMarketplaceSurface()) {
        void import('./pages/MarketplaceHomepage');
      } else {
        // TASK-4903: prefetch the resolved layout theme's package (contains Home) instead
        // of the page file directly — Home now ships inside its theme's chunk.
        void loadLayoutTheme(effectiveThemeId);
      }
    }

    // Keep loading screen visible briefly to prevent tenant flicker
    // This ensures the correct tenant branding is applied before the app renders
    await new Promise(resolve => setTimeout(resolve, 100));

    // ThemeProvider is seeded with the boot-resolved preset rather than a bare DEFAULT_THEME:
    // its mount effect re-runs applyTheme(initialTheme), which would otherwise stand the
    // layout's baked palette back up on top of an active color preset.
    root.render(
      <ThemeProvider initialTheme={effectiveColorPreset} enableDevSwitcher>
        <ErrorBoundary name="app-shell">
          <TenantJsonLd />
          <ApiConfigGuard>
            <App />
          </ApiConfigGuard>
        </ErrorBoundary>
      </ThemeProvider>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Runtime config missing/invalid'
    root.render(<ConfigErrorScreen message={message} />);
  }
};

bootstrapApp();
