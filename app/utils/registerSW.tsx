export default async function registerSW() {

    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js", { type: 'module' });
            console.log("Service Worker registered:", registration);
            await registration.update();
            window.addEventListener('online', () => {
                registration.active?.postMessage({ type: 'SYNC_QUEUE' });
            });
        } catch (error) {
            console.log("Service Worker registration failed:", error);
        }
    }
}