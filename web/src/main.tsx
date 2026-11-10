import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useAppStore } from './lib/store'

// Screenshot / QA hook (Play Store captures, local debugging).
;(window as unknown as { __HANDWERK_STORE__: typeof useAppStore }).__HANDWERK_STORE__ =
  useAppStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
