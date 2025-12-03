import { removeFromQueue, addToQueue, getDeleteQueue } from '/indexdb-queue.js';

const CACHE_NAME = 'my-pwa-cache-v5';
const STATIC_ASSET_CACHE = 'next-static-assets-v5';

const OFFLINE_ASSETS = [
    '/offline.html',
    '/offlineimage.webp',
    '/offlinevideo.webm',
    '/manifest.json'
];

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

// Helper to safely cache a cloned response
async function cachePut(cacheName, req, res) {
    const cache = await caches.open(cacheName);
    await cache.put(req, res.clone());
}

// Install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(OFFLINE_ASSETS))
            .catch(err => console.error('Failed to cache files during install:', err))
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.map(n => n !== CACHE_NAME && caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

async function processQueue() {
    const queue = await getDeleteQueue();
    for (const item of queue) {
        try {
            const endpoint = item.operation === "deleteConversation" ? "conversation" : "chat";
            const method = item.operation === "saveMessage" ? "POST" : "DELETE";

            const response = await fetch('/api/' + endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            if (response.ok) {
                await removeFromQueue(item.id);

                if (item.operation === "saveMessage") {
                    const savedDocument = await response.json();
                    const tempId = item.data.messageBody._id;

                    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'MESSAGE_SYNCED',
                                tempId: tempId,
                                savedMessage: savedDocument
                            });
                        });
                    });
                }

            } else {
                console.error(`Sync failed for ${item.operation} with status ${response.status}:`, item.id);
            }
        } catch (error) {
            console.log('Sync failed, will retry later:', error);
            break;
        }
    }
}

// Fetch
self.addEventListener('fetch', async event => {
    const req = event.request;
    const url = new URL(req.url);

    const isNavigation =
        req.mode === 'navigate' ||
        req.destination === 'document' ||
        req.headers.get('accept')?.includes('text/html');

    if (isNavigation) {
        event.respondWith(
            (async () => {
                try {
                    const networkRes = await fetch(req);

                    if (networkRes.status === 200 && !shouldNeverCache(url.pathname)) {
                        cachePut(CACHE_NAME, req, networkRes);
                    }
                    return networkRes;

                } catch {
                    const fallback = await caches.match('/offline.html');
                    return fallback || new Response('Offline page not found', {
                        status: 503,
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
            })()
        );
        return;
    }

    if (url.pathname.startsWith('/api/conversations') || url.pathname.startsWith('/api/messages')) {
        event.respondWith(
            (async () => {
                let cachedRes = await caches.match(req);
                if (cachedRes) {
                    return cachedRes;
                }
                try {
                    const networkRes = await fetch(req);
                    if (networkRes.status === 200) {
                        cachePut(CACHE_NAME, req, networkRes.clone());
                    }
                    return networkRes;
                } catch {
                    return new Response(JSON.stringify({ error: 'Data unavailable offline' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            })()
        );
        return;
    }


    if (event.request.method === 'POST' && url.pathname === '/chat') {
        event.respondWith(
            fetch(event.request.clone())
                .catch(async (error) => {
                    try {
                        const body = await event.request.clone().json();

                        const hasObjectIdPayload = Array.isArray(body) &&
                            body.length > 0 &&
                            typeof body[0] === 'string' &&
                            body[0].match(/^[a-f0-9]{24}$/);

                        const isDeleteMessage = hasObjectIdPayload && body.length === 2 && body[1] === 'message';
                        const isDeleteConversation = hasObjectIdPayload && body.length === 2 && body[1] === 'conversation';
                        const isSaveMessage =
                            Array.isArray(body) &&
                            typeof body[0]?._id === "string" &&
                            /^\d+$/.test(body[0]._id) &&  // numeric tempId
                            Object.keys(body[0]).length === 7;

                        if (isDeleteMessage) {
                            await addToQueue('deleteMessage', { messageId: body[0] });
                            self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                                clients.forEach(client => {
                                    client.postMessage({
                                        type: 'MESSAGE_DELETED_QUEUED',
                                        id: body[0]
                                    });
                                });
                            });
                        }
                        else if (isDeleteConversation) {
                            await addToQueue('deleteConversation', { conversationId: body[0] });
                            self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                                clients.forEach(client => {
                                    client.postMessage({
                                        type: 'CONVERSATION_DELETED_QUEUED',
                                        id: body[0]
                                    });
                                });
                            });

                        }
                        else if (isSaveMessage) {
                            const messageToSave = { ...body[0], date: new Date().toISOString(), file: body[0].file === "$undefined" ? undefined : body[0].file }
                            await addToQueue('saveMessage', { messageBody: messageToSave });
                        }

                        return new Response(JSON.stringify({
                            queued: true,
                            offline: true,
                            data: body[0]
                        }), {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' }
                        });

                    } catch (queueError) {
                        console.error('Failed to queue operation:', queueError);
                    }

                    throw new Error('Network unavailable');
                })
        );
        return;
    }


    // Static assets (CSS, JS, Fonts, Images, Video)
    const isStaticImage =
        url.pathname.includes('/_next/static/') ||
        url.pathname.startsWith('/_next/image') ||
        url.pathname.match(/\.(css|js|woff2|woff|ttf|ico|png|svg|jpg|jpeg)$/);

    const isStaticVideo =
        url.pathname.match(/\.(mp4|webm|mov)$/);

    if (isStaticImage || isStaticVideo) {
        event.respondWith(
            (async () => {
                let cachedRes = await caches.match(req);
                if (cachedRes) return cachedRes;

                try {
                    const networkRes = await fetch(req);
                    if (networkRes && networkRes.status === 200) {
                        cachePut(STATIC_ASSET_CACHE, req, networkRes.clone());
                    }
                    return networkRes;
                } catch (error) {
                    const fallback = isStaticImage
                        ? await caches.match('/offlineimage.webp')
                        : await caches.match('/offlinevideo.webm');

                    if (fallback) return fallback;
                    return new Response('Asset not available offline', { status: 404 });
                }
            })()
        );
        return;
    }
});


self.addEventListener('message', async event => {
    if (event.data.type === 'SYNC_QUEUE') {
        await processQueue();
    }
    if (event.data?.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(names => {
                return Promise.all(
                    names
                        .filter(n => n !== CACHE_NAME)
                        .map(n => {
                            return caches.delete(n);
                        })
                );
            })
        );
    }
});