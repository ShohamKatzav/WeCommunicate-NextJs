const CACHE_NAME = 'wecommunicate-v5';
const urlsToCache = [
    '/offline.html'
];

// Routes that should NEVER be cached
const NEVER_CACHE = [
    '/',
    '_not-found',
    '/about',
    '/chat',
    '/contact',
    '/forgot-password',
    '/locations',
    '/login',
    '/sign-up',
];

// Check if URL should never be cached
function shouldNeverCache(url) {
    return NEVER_CACHE.some(path => url.includes(path));
}

// Install event - cache the offline page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Don't cache POST requests or non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Never cache auth-related routes - always fetch fresh, fallback to offline
    if (shouldNeverCache(url)) {
        event.respondWith(
            fetch(event.request, { credentials: "include" })
                .catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // For navigation requests (page loads)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { credentials: "include" })
                .catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // For all other requests, try network first
    event.respondWith(
        fetch(event.request, { credentials: "include" })
            .then((response) => {
                // Cache successful responses for static assets
                if (response && response.status === 200) {
                    const shouldCache =
                        url.includes('/_next/static/') ||
                        url.endsWith('.css') ||
                        url.endsWith('.js') ||
                        url.endsWith('.woff2') ||
                        url.endsWith('.woff') ||
                        url.endsWith('.ttf');

                    if (shouldCache) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return response;
            })
            .catch(() => {
                // Try to serve from cache
                return caches.match(event.request);
            })
    );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                return self.clients.claim();
            })
        );
    }
});