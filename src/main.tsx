import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Runtime config missing/invalid'
    root.render(<ConfigErrorScreen message={message} />)
  }
}

bootstrapApp()
