// Guardian service worker.
//
// Scope is /guardian/ only, so this never touches the rest of the site. It
// caches the app shell so the app opens instantly and still opens with a weak
// signal - which is exactly when someone needs it. Nothing about a sharing
// session is cached: positions and streams never pass through here.
const CACHE = 'guardian-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept the relay, map tiles or anything else off-origin: a stale
  // cached answer from a live service is worse than no answer.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/guardian/') && url.origin === self.location.origin) {
    // A repo served from a sub-path still lands here; fall back to scope check.
    if (!request.url.startsWith(self.registration.scope)) return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
