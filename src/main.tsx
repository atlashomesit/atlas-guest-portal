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
import { getApiBaseUrlSafe } from './config/api'
import { loadRuntimeConfig } from './config/runtimeConfig'

const bootstrapApp = async () => {
  applyTheme(DEFAULT_THEME)
  initMonitoring()
  initAnalytics()

  const runtimeConfig = await loadRuntimeConfig()
  const apiBaseUrl = getApiBaseUrlSafe()
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'server'
  const envLabel = runtimeConfig.env || import.meta.env.MODE || 'unknown'

  console.info(
    `[startup] host=${hostname} env=${envLabel} apiBaseUrl=${apiBaseUrl || '(missing)'}`,
  )

  createRoot(document.getElementById('root')!).render(
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
}

bootstrapApp()
