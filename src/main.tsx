import { createRoot } from 'react-dom/client'
import 'react-date-range/dist/styles.css'
import 'react-date-range/dist/theme/default.css'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import { DEFAULT_THEME, applyTheme } from './styles/theme'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import ApiConfigGuard from './components/ApiConfigGuard'
import { initMonitoring } from './lib/monitoring'
import { initAnalytics } from './utils/analytics'
import { ThemeProvider } from './theme/ThemeProvider'
import { loadRuntimeConfig, setRuntimeConfig, getApiBaseUrl } from './runtime-config'
import { getApiHeaders } from './api/client'
import { getTenantSlug, setMarketplaceMode } from './tenant/tenantResolver'
import { validateTenant, resolveFromDomain, getTenantContext } from './tenant/tenantContext'
import { applyTenantBranding } from './tenant/tenantBranding'
import { ConfigLoadingScreen } from './runtime-config/ConfigLoadingScreen'
import { ConfigErrorScreen } from './runtime-config/ConfigErrorScreen'

// Suppress chrome extension module loading errors in console (non-critical, expected in dev)
const isExtensionModuleError = (message: string, filename?: string) =>
  message.includes("Failed to fetch dynamically imported module") &&
  filename?.includes("chrome-extension://");

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

const bootstrapApp = async () => {
  applyTheme(DEFAULT_THEME)
  initMonitoring()
  initAnalytics()

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
    const domainResolved = domain ? await resolveFromDomain(apiBaseUrl, domain) : null;

    if (!domainResolved) {
      // 2. Fall back to runtime config tenantKey (legacy / explicit override)
      const tenantSlug = getTenantSlug({ fallbackSlug: config.tenantKey });
      if (tenantSlug) {
        try {
          await validateTenant(tenantSlug);
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn('[Atlas] Tenant validation failed (dev — continuing):', e);
          } else {
            throw e;
          }
        }
      } else if (!import.meta.env.DEV) {
        throw new Error('Tenant could not be resolved. Check /.well-known/atlas-runtime-config.json (tenantKey) or ensure the domain is registered in the Atlas tenant table.');
      }
    }

    // 3. Apply brand config to DOM (title, primaryColor CSS vars, favicon)
    const forceMarketplaceFromConfig = (config.tenantKey || '').trim().toLowerCase() === 'marketplace-root';
    const resolved = getTenantContext();
    if (resolved?.isMarketplaceRoot || forceMarketplaceFromConfig) {
      setMarketplaceMode(true);
    } else if (resolved) {
      applyTenantBranding(resolved);
    }

    // Keep loading screen visible briefly to prevent tenant flicker
    // This ensures the correct tenant branding is applied before the app renders
    await new Promise(resolve => setTimeout(resolve, 100));

    root.render(
      <ThemeProvider initialTheme={DEFAULT_THEME}>
        <ErrorBoundary name="app-shell">
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
