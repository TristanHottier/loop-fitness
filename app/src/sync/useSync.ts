import { useEffect } from 'react'
import { isConfigured, getToken, syncNow } from '../sync/sync'

// Flush pending changes and pull remote changes when the app is online and
// visible. Runs on mount, on the window focus/online events, and on a light
// interval so offline edits sync later without a manual trigger.
export function useSync(): void {
  useEffect(() => {
    if (!isConfigured() || !getToken()) return

    let timer: number | undefined

    async function run() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        await syncNow()
      }
    }

    function onOnline() {
      void run()
    }
    function onFocus() {
      void run()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    timer = window.setInterval(() => {
      void run()
    }, 60000)

    void run()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [])
}
