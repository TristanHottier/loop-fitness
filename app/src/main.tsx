import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme, getStoredTheme } from './theme'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/tokens.css'

// Apply the stored theme before the first paint so the default dark theme
// (or a saved light theme) is visible immediately.
applyTheme(getStoredTheme())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
