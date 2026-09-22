// A classic script (not `{ type: 'module' }` at registration), so
// importScripts() rather than `import` - see the comment at the top of
// indexdb-queue.js for why. importScripts() must run at the top level,
// synchronously, before any other statement that depends on it.
importScripts('/indexdb-queue.js');

// Bumped whenever the SW's own format changes (e.g. module -> classic
// script) as well as on cache-shape changes - a client still running the
// previous worker needs a cache name it doesn't recognise so `activate`'s
// cleanup (below) actually clears its stale caches instead of reusing them.
const CACHE_NAME = 'my-pwa-cache-v7';
const STATIC_ASSET_CACHE = 'next-static-assets-v7';
let isSyncing = false;

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
    '/moderator',
    '/share-target',
    '/sign-up',
];

const OFFLINE_QUEUE_PATHS = [
    '/chat',
    '/api/chat',
    '/api/cleanhistory',
    '/api/conversation'
];

function shouldNeverCache(url) {
    return NEVER_CACHE.some(path => url.includes(path));
}

// Helper to safely cache a cloned response
async function cachePut(cacheName, req, res) {
    const cache = await caches.open(cacheName);
    await cache.put(req, res.clone());
}

// Broadcasts the current queue to every open tab so the offline outbox UI
// (useOfflineOutbox.tsx) stays live without polling - called after anything
// that adds to or removes from the queue. Errors here shouldn't break the
// actual queue operation that triggered them, so this never throws.
async function notifyQueueChanged() {
    try {
        const queue = await getDeleteQueue();
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach(client => {
            client.postMessage({ type: 'QUEUE_CHANGED', queue });
        });
    } catch (error) {
        console.error('Failed to notify clients of queue change:', error);
    }
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

self.addEventListener('sync', async (event) => {
    if (event.tag === 'sync-queue') {
        event.waitUntil(processQueue());
    }
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            // STATIC_ASSET_CACHE must be kept too - it wasn't populated yet
            // during install, so on first activation this used to delete it
            // right after it started filling, defeating static asset caching.
            .then(names => Promise.all(names.map(n => ![CACHE_NAME, STATIC_ASSET_CACHE].includes(n) && caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json()
        const options = {
            body: data.body,
            icon: data.icon || '/icon.png',
            badge: data.icon || '/icon.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
            },
        }
        event.waitUntil(self.registration.showNotification(data.title, options))
    }
})

self.addEventListener('notificationclick', function (event) {
    event.notification.close()
    // Use the SW's own scope instead of a hardcoded origin - a hardcoded
    // URL breaks on any deployment other than the one it was written for
    // (including local dev), and always opening a new window instead of
    // focusing an existing tab piles up duplicate tabs.
    const targetUrl = new URL('chat', self.registration.scope).href;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
})

async function processQueue() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        let queue = await getDeleteQueue();
        let i = 0;
        while (i < queue.length) {
            const item = queue[i];

            const endpoint = item.operation === "deleteConversation" ? "conversation" :
                item.operation === "cleanHistory" ? "cleanhistory" : "chat";
            const method = (item.operation === "saveMessage" || item.operation === "cleanHistory") ? "POST" : "DELETE";

            const response = await fetch('/api/' + endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            if (response.ok) {
                // Handle saveMessage specially - update IDs BEFORE removing from queue
                if (item.operation === "saveMessage") {
                    const savedDocument = await response.json();
                    const tempId = item.data.messageBody._id;
                    const realId = savedDocument._id;
                    const isDeleteQueued = await mapQueuedId('deleteMessage', tempId, realId);
                    let messageStatus = 'sent';
                    if (isDeleteQueued) {
                        messageStatus = 'revoked';
                    }

                    queue = await getDeleteQueue();

                    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'MESSAGE_SYNCED',
                                tempId: tempId,
                                savedMessage: {
                                    ...savedDocument,
                                    status: messageStatus
                                },
                            });
                        });
                    });
                }

                // Distinct from MESSAGE_SYNCED so useServiceWorkerSync can
                // drop the local pending-clear record (app/hooks/
                // usePendingCleanHistory.tsx) now that the server's own
                // cutoff exists and every read path already honors it.
                if (item.operation === "cleanHistory") {
                    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'CLEAN_HISTORY_SYNCED',
                                conversationId: item.data.conversationId,
                            });
                        });
                    });
                }

                await removeFromQueue(item.id);
                queue = await getDeleteQueue();

            } else if (response.status >= 400 && response.status < 500) {
                // A definite rejection (moderation block, ban, unauthorized,
                // etc., now that the API routes report these accurately
                // instead of always returning 200) - retrying this will only
                // ever fail the same way, so drop it instead of retrying it
                // forever on every future reconnect.
                console.error(`Permanently rejected ${item.operation} with status ${response.status}, dropping from queue:`, item.id);
                if (item.operation === "cleanHistory") {
                    // The clear never actually applied server-side - drop the
                    // local record too so the client stops hiding history the
                    // server never agreed to hide, and re-fetch to bring it back.
                    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'CLEAN_HISTORY_REJECTED',
                                conversationId: item.data.conversationId,
                            });
                        });
                    });
                }
                await removeFromQueue(item.id);
                queue = await getDeleteQueue();
            } else {
                console.error(`Sync failed for ${item.operation} with status ${response.status}:`, item.id);
                i++;
            }

        }
    }
    catch (error) {
        console.log('Sync failed, will retry later:', error);
        if ('sync' in self.registration) {
            try {
                await self.registration.sync.register('sync-queue');
            } catch (error) {
                console.error('Failed to register sync:', error);
            }
        }
    }
    finally {
        isSyncing = false;
        // Once per call rather than after every removeFromQueue - the queue
        // only actually needs re-broadcasting once processing settles.
        await notifyQueueChanged();
    }
}

// Fetch
self.addEventListener('fetch', async event => {
    const req = event.request;
    const url = new URL(req.url);

    // Do not catch my SW
    if (url.pathname === '/service-worker.js') {
        return;
    }

    // The OS share sheet POSTs here as a full-page navigation. Let the
    // browser follow the 303 to /chat?shared= itself - if the SW intercepts
    // and fetch()-follows that redirect, the document URL can stay on
    // /share-target and chat never sees the token it needs to consume.
    if (url.pathname === '/share-target') {
        return;
    }

    const isNavigation =
        req.mode === 'navigate' ||
        req.destination === 'document' ||
        req.headers.get('accept')?.includes('text/html');

    if (isNavigation || url.pathname === '/offline.html') {
        event.respondWith(
            (async () => {
                try {
                    // Force a no-store network fetch for navigations so we don't get a stale
                    // cached HTML document from the browser HTTP cache. If network is unavailable
                    // this will throw and we will return the offline fallback.
                    const networkRes = await fetch(req, { cache: 'no-store' });
                    if (networkRes.status === 200 && !shouldNeverCache(url.pathname)) {
                        cachePut(CACHE_NAME, req, networkRes);
                    }
                    return networkRes;

                } catch (err) {
                    // On network failure, always serve the offline page so targeted
                    // navigations show the offline UI deterministically.
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

    if (
        (event.request.method === 'POST' || event.request.method === 'DELETE') &&
        OFFLINE_QUEUE_PATHS.includes(url.pathname)
    ) {
        event.respondWith(
            fetch(event.request.clone())
                .catch(async (error) => {
                    try {
                        const body = await event.request.clone().json();

                        // A real, persisted document always has a Mongo ObjectId; a
                        // pending/temp id (however it's generated client-side -
                        // timestamp string, UUID, etc.) never does. Using "is this a
                        // valid ObjectId" as the single signal, instead of matching a
                        // specific temp-id format, keeps this in sync with however the
                        // client happens to generate temp ids (see messageBubble.tsx's
                        // isPending check, which uses the same rule).
                        const isMongoObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
                        const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

                        const hasObjectIdPayload = Array.isArray(body) &&
                            body.length > 0 &&
                            isMongoObjectId(body[0]);

                        const hasTempIdPayload = Array.isArray(body) &&
                            body.length > 0 &&
                            typeof body[0] === 'string' &&
                            !isMongoObjectId(body[0]);

                        const isDeleteMessage = (hasObjectIdPayload || hasTempIdPayload) && body.length === 2 && body[1] === 'message';
                        const isDeleteConversation = hasObjectIdPayload && body.length === 2 && body[1] === 'conversation';
                        // 3 args, not 2 - cleanHistory's server action now also
                        // carries the click-time clearedAt (see
                        // conversationActions.ts' cleanHistory) so the replay
                        // below can apply it instead of flush time.
                        const isCleanHistory = hasObjectIdPayload && body.length === 3 && body[1] === 'cleanHistory';
                        // Recognise a pending message by the fields the save
                        // actually needs, not by an exact key count. Counting keys
                        // meant adding or removing a single optional field on
                        // MessageDTO silently stopped offline sends from being
                        // queued at all, with nothing to point at the cause.
                        const isSaveMessage =
                            Array.isArray(body) &&
                            isPlainObject(body[0]) &&
                            typeof body[0]._id === "string" &&
                            !isMongoObjectId(body[0]._id) &&  // pending id, not yet a persisted message
                            typeof body[0].sender === "string" &&
                            'conversationID' in body[0] &&
                            'participantID' in body[0];

                        let queued = false;

                        if (isDeleteMessage) {
                            await addToQueue('deleteMessage', { messageId: body[0] });
                            queued = true;
                        }
                        else if (isDeleteConversation) {
                            await addToQueue('deleteConversation', { conversationId: body[0] });
                            queued = true;
                        }
                        else if (isSaveMessage) {
                            // A server action serialises `undefined` as the string
                            // "$undefined". Drop every field carrying that marker
                            // rather than special-casing `file`, so a newly added
                            // optional field can't reach the API as that literal.
                            const withoutUndefinedMarkers = Object.fromEntries(
                                Object.entries(body[0]).filter(([, value]) => value !== "$undefined")
                            );
                            const messageToSave = { ...withoutUndefinedMarkers, date: new Date().toISOString() };
                            await addToQueue('saveMessage', { messageBody: messageToSave });
                            queued = true;
                        }

                        else if (isCleanHistory) {
                            await addToQueue('cleanHistory', { conversationId: body[0], clearedAt: body[2] });
                            queued = true;
                        }

                        if (!queued) {
                            // Nothing matched a known shape - don't lie and claim we
                            // queued something we didn't, or the caller (and the user)
                            // will believe this will be retried when it silently won't.
                            console.error('Unrecognized offline request shape, not queued:', body);
                            return new Response(JSON.stringify({
                                queued: false,
                                offline: true,
                                error: 'Unrecognized request - not queued for retry'
                            }), {
                                status: 503,
                                headers: { 'Content-Type': 'application/json' }
                            });
                        }

                        await notifyQueueChanged();

                        return new Response(JSON.stringify({
                            queued: true,
                            offline: true,
                            data: body[0]
                        }), {
                            status: 503,
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
    if (event.data?.type === 'GET_QUEUE') {
        // Answers the offline outbox UI's initial snapshot request on mount
        // (useOfflineOutbox.tsx) - after that it just listens for the
        // broadcast QUEUE_CHANGED messages notifyQueueChanged() sends.
        const port = event.ports[0];
        const queue = await getDeleteQueue();
        if (port) port.postMessage({ queue });
        return;
    }

    if (event.data.type === 'SYNC_QUEUE') {
        await processQueue();
        if ('sync' in self.registration) {
            try {
                await self.registration.sync.register('sync-queue');
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
    }

    if (event.data?.type === 'CLEAR_CACHE') {
        const port = event.ports[0];
        try {
            await event.waitUntil(
                caches.keys().then(names => {
                    return Promise.all(
                        names
                            .filter(n => ![CACHE_NAME, STATIC_ASSET_CACHE].includes(n))
                            .map(n => caches.delete(n))
                    );
                })
            );

            if (port) {
                port.postMessage({ success: true });
            }
        } catch (error) {
            console.error('Cache clear error:', error);
            if (port) {
                port.postMessage({ success: false, error: error.message });
            }
        }
    }
});