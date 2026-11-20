// ALADO service worker: keeps the app shell (page + JS/CSS) so it opens without signal.
// Data lives in IndexedDB (the app's job); the API is never cached here.
const CACHE = 'alado-shell-v2'
const NAV_TIMEOUT_MS = 3000

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

const isAsset = url => url.pathname.startsWith('/assets/')
// Never store an HTML fallback (or an error page) under a JS/CSS URL.
const cacheable = (url, res) => res.ok && !(isAsset(url) && (res.headers.get('content-type') || '').includes('text/html'))

// The page sends the JS/CSS it loaded before this worker took control, so they are cached too.
self.addEventListener('message', event => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return
  event.waitUntil(caches.open(CACHE).then(async c => {
    for (const u of event.data.urls) {
      const url = new URL(u, self.location.origin)
      if (url.origin !== self.location.origin || !isAsset(url) || await c.match(url.pathname)) continue
      try {
        const res = await fetch(url.pathname)
        if (cacheable(url, res)) await c.put(url.pathname, res)
      } catch { /* offline: next time */ }
    }
  }))
})

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Pages: network first (fresh app after a deploy) but give up after 3 s on weak signal.
  if (req.mode === 'navigate') {
    const network = fetch(req).then(res => {
      if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put('/', copy))
      }
      return res
    })
    event.respondWith(
      withTimeout(network, NAV_TIMEOUT_MS)
        .catch(() => caches.match('/').then(hit => hit || network))
    )
    return
  }

  // Built assets have hashed names: cache first, filled on first use.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (cacheable(url, res)) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy))
      }
      return res
    }))
  )
})
