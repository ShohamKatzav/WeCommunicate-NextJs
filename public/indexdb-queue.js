const DB_NAME = 'offline-queue-db-v6';
const STORE_NAME = 'operations-queue-v6';

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

export async function addToQueue(operation, data) {
    let db;
    try {
        db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const item = {
            operation,
            data,
            timestamp: Date.now()
        };

        await new Promise((resolve, reject) => {
            const request = store.add(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-queue');
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
        return true;
    } catch (error) {
        console.error('Failed to add to queue:', error);
        return false;
    } finally {
        if (db) db.close();
    }
}

export async function getDeleteQueue() {
    let db;
    try {
        db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to get queue:', error);
        return [];
    } finally {
        if (db) db.close();
    }
}

export async function removeFromQueue(id) {
    let db;
    try {
        db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        await new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        return true;
    } catch (error) {
        console.error('Failed to remove from queue:', error);
        return false;
    } finally {
        if (db) db.close();
    }
}

export async function clearQueue() {
    let db;
    try {
        db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        await new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        return true;
    } catch (error) {
        console.error('Failed to clear queue:', error);
        return false;
    } finally {
        if (db) db.close();
    }
}


export async function mapQueuedId(operation, tempId, realId) {
    let db;
    try {
        db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const allItems = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });

        let foundAndUpdated = false;
        for (const item of allItems) {
            if (item.operation === operation && item.data.messageId === tempId) {

                const updatedItem = {
                    ...item,
                    data: { messageId: realId }
                };
                await new Promise((resolve, reject) => {
                    const request = store.put(updatedItem);
                    request.onsuccess = () => resolve();
                    request.onerror = (e) => reject(e.target.error);
                });

                foundAndUpdated = true;
                break;
            }
        }

        // Wait for the transaction to complete
        await new Promise(resolve => transaction.oncomplete = resolve);

        return foundAndUpdated;
    } catch (error) {
        console.error('Failed to map queued ID:', error);
        throw error;
    } finally {
        if (db) db.close();
    }
}