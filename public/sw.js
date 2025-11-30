

const CACHE_NAME = globalThis.__NEXT_PUBLIC_OFFLINE_CACHE_NAME__;
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
        ).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.url.includes('/_next/') || req.url.includes('/rsc')) {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // Non GET Actions.. POST etc..
    if (req.method !== 'GET') {
        event.respondWith(
            fetch(req).catch(() => {
                return new Response('{"error": "offline", "message": "Failed to connect to the server."}', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Full reload
    const isNavigation = req.mode === 'navigate' ||
        req.destination === 'document' ||
        (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

    if (isNavigation) {
        event.respondWith(
            fetch(req).catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // GET inside a NEVER_CACHE route + RSC internal fetches
    if (shouldNeverCache(url.pathname)) {
        event.respondWith(
            fetch(req)
                .catch(() => {
                    return caches.match(req);
                })
        );
        return;
    }

    // GET requests: network first + cache static assets
    event.respondWith(
        fetch(req)
            .then(res => {
                if (res && res.status === 200) {
                    const isStatic =
                        url.pathname.includes('/_next/static/') ||
                        url.pathname.endsWith('.css') ||
                        url.pathname.endsWith('.js') ||
                        url.pathname.endsWith('.woff2') ||
                        url.pathname.endsWith('.woff') ||
                        url.pathname.endsWith('.ttf');

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
            ));
    }
});