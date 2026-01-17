/* Simple service worker for asset caching */
const VERSION = 'v2.0.3';
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
  '/dist/bundle.min.css',
  '/dist/core.min.js',
  '/dist/dashboard.min.js',
  '/dist/bundle.min.js',
  '/assets/JB_Bearish_Market_FULL_page.png',
  '/assets/Logo%208.5.png',
];

self.addEventListener('install', (event) => {
  // Activate updated SW immediately to avoid stale CSP/logic in old workers.
  // Precache is best-effort so a single 404 doesn't block activation.
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
    })()
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

function shouldBypassCaching(url) {
  // Never cache HTML or root-level runtime scripts/config.
  if (url.pathname === '/sw.js') return true;
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/index.html') return true;
  if (url.pathname === '/config.js' || url.pathname.startsWith('/config.')) return true;
  return false;
}

function isCacheableAssetPath(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/dist/');
}

// Helper: cache-first for static assets
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cacheControl = (response && response.headers && response.headers.get('Cache-Control')) || '';
    const doNotStore = /no-store|no-cache|max-age=0|must-revalidate/i.test(cacheControl);
    // Only cache successful, same-origin GET requests
    if (
      response &&
      response.status === 200 &&
      request.method === 'GET' &&
      new URL(request.url).origin === self.location.origin &&
      !doNotStore
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
    // For other assets, return a minimal error response to satisfy Response contract
    return new Response('Offline', { status: 502, statusText: 'Offline' });
  }
}

// Helper: network-first for HTML navigations (no stale HTML trapping)
async function networkFirstNavigation(event) {
  const request = event.request;
  const cache = await caches.open(CORE_CACHE);
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;

    // Force a real revalidation to avoid browser HTTP cache returning stale HTML.
    const response = await fetch(new Request(request, { cache: 'reload' }));
    if (response && response.status === 200) {
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match('/index.html');
    if (cached) return cached;
    return new Response('Offline', { status: 502, statusText: 'Offline' });
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
    event.respondWith(networkFirstNavigation(event));
    return;
  }
  // Never cache these (avoid trapping users on old JS/config)
  if (shouldBypassCaching(url)) {
    event.respondWith(fetch(new Request(req, { cache: 'reload' })));
    return;
  }

  // Cache only known static asset folders (safe to cache long-term)
  if (isCacheableAssetPath(url) && /\.(css|js|png|jpg|jpeg|svg|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Default: pass-through (no SW caching)
});
