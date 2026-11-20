// ALADO service worker: keeps the app shell so it opens without signal.
// Data lives in IndexedDB (the app's job); the API is never cached here.
const CACHE = 'alado-shell-v1'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Pages: network first (fresh app after a deploy), cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put('/', copy))
        return res
      }).catch(() => caches.match('/'))
    )
    return
  }

  // Built assets have hashed names: cache first, filled on first use.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy))
      }
      return res
    }))
  )
})
