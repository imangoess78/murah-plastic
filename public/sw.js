/* Murah Plastic — Service Worker (PWA) v1.0.3 */
const VERSION = 'murah-plastic-v1.0.3';
const CORE_CACHE = VERSION + '-core';
const ASSET_CACHE = VERSION + '-assets';
const PAGE_CACHE = VERSION + '-pages';

const CORE_ASSETS = [
  '/',
  '/assets/site.css',
  '/assets/site.js',
  '/assets/og-image.jpg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/offline'
];

// Install: precache shell inti
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CORE_CACHE)
      .then((c) => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache versi lama, langsung kontrol semua tab
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Helper: cek apakah request asset statis (css/js/img/font/svg)
function isStaticAsset(url) {
  return /\.(css|js|png|jpe?g|gif|webp|svg|woff2?|ico|webmanifest|json)$/i.test(url.pathname);
}
// Helper: cek apakah request API
function isApi(url) {
  return url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Hanya handle same-origin (jangan sentuh CDN eksternal)
  if (url.origin !== self.location.origin) return;

  // 1) API → network-only (tidak pernah di-cache)
  if (isApi(url)) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // 2) Navigasi halaman → network-first, fallback cache → offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(url.pathname);
          if (cached) return cached;
          const home = await caches.match('/');
          if (home) return home;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // 3) Aset statis → cache-first + update background
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 4) Lainnya → default (network)
});
