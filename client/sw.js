/* Simple service worker for asset caching */
const VERSION = 'v2.0.0';
const CORE_CACHE = `core-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

// External domains to never intercept
const EXTERNAL_DOMAINS = [
  'a.espncdn.com',
  'espncdn.com',
  'api.espn.com',
  'site.api.espn.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  // Never intercept Azure Blob Storage or Front Door CDN
  'blob.core.windows.net',
  'azurefd.net'
];

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
    // Return cached if available, otherwise return offline response
    if (cached) return cached;
    // For images, return a 1x1 transparent PNG instead of erroring
    if (request.destination === 'image') {
      return new Response(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x08, 0x5b, 0x63,
          0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01, 0x01, 0x00, 0x1b, 0xb6, 0xee,
          0x56, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
          0x60, 0x82
        ]),
        { status: 200, headers: { 'Content-Type': 'image/png' } }
      );
    }
    throw err;
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
  
  // Skip cross-origin requests entirely - let browser handle them
  if (url.origin !== self.location.origin) {
    // Don't call event.respondWith() - just return to let browser handle
    return;
  }
  
  // Double-check: skip any ESPN/external CDN requests that slip through
  if (EXTERNAL_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return;
  }
  
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
