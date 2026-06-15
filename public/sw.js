/*
 * Service worker.
 *
 * Navigations are NETWORK-FIRST so the HTML shell (and the hashed asset names
 * it references) is always fresh after a redeploy; the cached copy is only a
 * fallback for offline. Hashed build assets are immutable, so they stay
 * cache-first. Bump VERSION to drop old caches.
 */
const VERSION = 'v2';
const CACHE = `mahjong-tracker-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Network-first for page loads: never serve a stale shell that points at
  // asset hashes deleted by the latest deploy.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r ?? caches.match('./'))),
    );
    return;
  }

  // Cache-first for hashed assets and other GETs, caching successful responses.
  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
