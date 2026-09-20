'use client';
import { useCallback, useEffect, useState } from 'react';

export interface QueuedOperation {
    id: number;
    operation: 'saveMessage' | 'deleteMessage' | 'deleteConversation' | 'cleanHistory';
    data: any;
    timestamp: number;
}

// Makes the previously-invisible IndexedDB offline queue (public/indexdb-queue.js)
// visible: the service worker broadcasts QUEUE_CHANGED whenever it adds to or
// drains the queue (see notifyQueueChanged in service-worker.js), and this
// just mirrors that into React state - no polling.
export const useOfflineOutbox = () => {
    const [queue, setQueue] = useState<QueuedOperation[]>([]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'QUEUE_CHANGED') {
                setQueue(event.data.queue || []);
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);

        // Only meaningful once a service worker actually controls this page -
        // on a brand new install there's nothing queued yet anyway (nothing
        // could have been queued before this page existed to queue it).
        const requestSnapshot = () => {
            const controller = navigator.serviceWorker.controller;
            if (!controller) return;
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                setQueue(event.data?.queue || []);
            };
            controller.postMessage({ type: 'GET_QUEUE' }, [channel.port2]);
        };
        requestSnapshot();
        // A controller can become active after mount (e.g. the very first
        // page load, before the SW has claimed the page yet) - catch that
        // transition too instead of only ever checking once.
        navigator.serviceWorker.addEventListener('controllerchange', requestSnapshot);

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            navigator.serviceWorker.removeEventListener('controllerchange', requestSnapshot);
        };
    }, []);

    const retryNow = useCallback(() => {
        navigator.serviceWorker?.controller?.postMessage({ type: 'SYNC_QUEUE' });
    }, []);

    return { queue, retryNow };
};
