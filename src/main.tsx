import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, readStoredTheme } from './theme'

const initialTheme = readStoredTheme()
applyTheme(initialTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialTheme={initialTheme} />
  </StrictMode>,
)
