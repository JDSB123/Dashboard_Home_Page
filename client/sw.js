/* Simple service worker for asset caching */
const VERSION = 'v1.0.0';
const CORE_CACHE = `core-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

// Assets to pre-cache (weekly lineup critical)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/weekly-lineup.html',
  '/dist/bundle.min.css',
  '/dist/core.min.js',
  '/dist/dashboard.min.js',
  '/dist/bundle.min.js',
  '/assets/JB_Bearish_Market_FULL_page.png',
  '/assets/Logo%208.5.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!key.startsWith('core-') && !key.startsWith('assets-')) return;
          if (key !== CORE_CACHE && key !== ASSET_CACHE) {
            return caches.delete(key);
          }
        })
      );
      // Enable navigation preload for faster network responses
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      self.clients.claim();
    })()
  );
});

// Helper: cache-first for static assets
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Only cache successful, same-origin GET requests
    if (
      response &&
      response.status === 200 &&
      request.method === 'GET' &&
      new URL(request.url).origin === self.location.origin
    ) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached; // fallback to cache if available
  }
}

// Helper: network-first for HTML navigations
async function networkFirst(request) {
  const cache = await caches.open(CORE_CACHE);
  try {
    const preload = await (self.registration.navigationPreload?.getState ? null : null);
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // HTML navigations
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }
  // Static assets: CSS/JS/images
  if (/\.(css|js|png|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Default: pass-through
});
