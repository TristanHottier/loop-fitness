export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'fitness-tracker:theme'

// Dark is the default theme.
export function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') {
      return stored
    }
  } catch {
    // localStorage may be unavailable, fall back to the default.
  }
  return 'dark'
}

// Apply a theme to the document and persist it.
export function setTheme(theme: Theme): void {
  applyTheme(theme)
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The theme still applies for this session.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}
