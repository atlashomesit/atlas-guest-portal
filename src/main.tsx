import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DEFAULT_THEME, applyTheme } from './styles/theme'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import ApiConfigGuard from './components/ApiConfigGuard'
import { initMonitoring } from './lib/monitoring'

applyTheme(DEFAULT_THEME)
initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="app-shell">
      <ApiConfigGuard>
        <App />
      </ApiConfigGuard>
    </ErrorBoundary>
  </StrictMode>,
)
