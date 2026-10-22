// Lift service worker.
// - App shell: hashed assets cache-first; pages network-first with the last copy as offline fallback.
// - Notification clicks bring the app back.
// Live data stays in Convex; this only keeps the app openable without signal.
const SHELL = 'lift-shell-v3'
const OFFLINE_HTML = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><meta name=theme-color content="#000"><title>Lift · Offline</title><body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#000;color:#f5f5f5;font:16px/1.5 -apple-system,system-ui,sans-serif;text-align:center;padding:24px"><div><div style="width:44px;height:44px;border-radius:12px;background:#b8f4d0;margin:0 auto 20px"></div><h1 style="font-size:22px;margin:0 0 8px">You're offline</h1><p style="color:#a3a3a3;margin:0 0 20px">Lift will reconnect as soon as you have signal.<br>Sets you already logged are kept.</p><button onclick="location.reload()" style="font:inherit;font-weight:600;background:#b8f4d0;color:#07110b;border:0;border-radius:999px;padding:12px 22px">Try again</button></div>`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/manifest.webmanifest', '/icon-192.png', '/icon.svg'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/mcp') return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // Clone synchronously: the browser consumes the original body right away.
            if (res.ok) {
              const copy = res.clone()
              caches.open(SHELL).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => {
          const cache = await caches.open(SHELL)
          return (
            (await cache.match(req)) ||
            (await cache.match('/workout')) ||
            (await cache.match('/')) ||
            new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          )
        }),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow('/workout')
    }),
  )
})
