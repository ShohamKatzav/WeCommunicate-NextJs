const CACHE_NAME = 'wecommunicate-v1';
const urlsToCache = ['/offline.html'];

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

function shouldNeverCache(url) {
    return NEVER_CACHE.some(path => url.includes(path));
}

// Install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(names.map(n => n !== CACHE_NAME && caches.delete(n)))
        )
    );
    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = req.url;

    // 🚨 MUST ALWAYS HANDLE NAVIGATION — mobile depends on this
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // Don't cache or apply stale responses for these pages
    if (shouldNeverCache(url)) {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // For non-GET requests → just try network, fallback offline
    if (req.method !== 'GET') {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // GET requests: network first + cache static assets
    event.respondWith(
        fetch(req)
            .then(res => {
                if (res && res.status === 200) {
                    const isStatic =
                        url.includes('/_next/static/') ||
                        url.endsWith('.css') ||
                        url.endsWith('.js') ||
                        url.endsWith('.woff2') ||
                        url.endsWith('.woff') ||
                        url.endsWith('.ttf');

                    if (isStatic) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(cache =>
                            cache.put(req, clone)
                        );
                    }
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});

// Clear cache
self.addEventListener('message', event => {
    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names =>
                Promise.all(names.map(n => caches.delete(n)))
            )
        );
    }
});