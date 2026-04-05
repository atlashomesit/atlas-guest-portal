import { StrictMode } from 'react'
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
import { getTenantSlug } from './tenant/tenantResolver'
import { validateTenant } from './tenant/tenantContext'
import { ConfigLoadingScreen } from './runtime-config/ConfigLoadingScreen'
import { ConfigErrorScreen } from './runtime-config/ConfigErrorScreen'

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
      throw new Error('Tenant "tenantKey" not found. Check /.well-known/atlas-runtime-config.json and set tenantKey (or ATLAS_TENANT_KEY in Cloudflare Pages env).');
    }

    root.render(
      <StrictMode>
        <ThemeProvider initialTheme={DEFAULT_THEME}>
          <ErrorBoundary name="app-shell">
            <ApiConfigGuard>
              <App />
            </ApiConfigGuard>
          </ErrorBoundary>
        </ThemeProvider>
      </StrictMode>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Runtime config missing/invalid'
    root.render(<ConfigErrorScreen message={message} />);
  }
};

bootstrapApp();
