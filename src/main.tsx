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
import { getApiBaseUrl } from './config/apiBaseUrl'

applyTheme(DEFAULT_THEME)
initMonitoring()
initAnalytics()
console.info(
  `Startup env: MODE=${import.meta.env.MODE}, PROD=${import.meta.env.PROD}, VITE_API_BASE_URL=${getApiBaseUrl()}`,
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
