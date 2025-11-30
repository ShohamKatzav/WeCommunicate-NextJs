
export default async function registerSW() {

    if (!process.env.NEXT_PUBLIC_OFFLINE_CACHE_NAME) {
        throw new Error("NEXT_PUBLIC_OFFLINE_CACHE_NAME isn't defiened");
    }

    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.register("/sw.js");
            console.log("Service Worker registered:", registration);

            //Manually ensure offline.html is cached
            if ('caches' in window) {
                const cache = await caches.open(process.env.NEXT_PUBLIC_OFFLINE_CACHE_NAME);
                await cache.add('/offline.html');
            }

            // Force update
            await registration.update();
        } catch (error) {
            console.log("Service Worker registration failed:", error);
        }
    }
}