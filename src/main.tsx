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

applyTheme(DEFAULT_THEME)
initMonitoring()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="app-shell">
      <ApiConfigGuard>
        <App />
      </ApiConfigGuard>
    </ErrorBoundary>
  </StrictMode>,
)
