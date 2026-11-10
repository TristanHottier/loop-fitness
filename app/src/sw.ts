/// <reference lib="webworker" />
// Service worker for the loop-fitness PWA.
// Built in injectManifest mode: vite-plugin-pwa injects the precache manifest
// into self.__WB_MANIFEST at build time. Push handlers are added here so the
// Worker can display Web Push reminders even when the app is closed.
// Reference: docs/fitness-app-brief.md, section 6 (reminders).

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Take over immediately on deploy instead of waiting for all tabs to close.
self.addEventListener('install', () => {
  void self.skipWaiting()
})
clientsClaim()

// Precache the build assets so the app shell works offline.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Fall back to the app shell for navigations when offline.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'))
)

// Cache images at runtime (gallery pictures, icons).
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
)

// Push: display the notification. The payload is the JSON PushPayload the
// Worker sends: { title, body, url, tag }.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {}
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { body: event.data.text() }
    }
  }
  const title = data.title ?? 'Fitness'
  const options: NotificationOptions = {
    body: data.body,
    tag: data.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click: focus an open tab at the target URL, or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const absolute = new URL(targetUrl, self.registration.scope).href
      const open = clients.find((client) => new URL(client.url).pathname === targetUrl)
      if (open) return open.focus()
      return self.clients.openWindow(absolute)
    })
  )
})
