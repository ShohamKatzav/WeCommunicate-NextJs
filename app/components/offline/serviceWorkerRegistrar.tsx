"use client";

import { useEffect } from "react";

// Installability (the WebAPK/"Add to Home screen" pipeline behind Chrome,
// Samsung Internet, Firefox Android, ...) requires a controlling service
// worker on the manifest's start_url ("/") before the browser will treat the
// site as installable. This used to only happen from pushNotificationManager,
// which mounts on /chat after login and only when both `serviceWorker` and
// `PushManager` exist - a logged-out visit, or any browser that supports
// installable PWAs but not (or not yet) push, never got a worker and the
// browser silently refused to install. Mounting this in the root layout
// means every page gets one, logged in or not; push subscription itself
// stays chat-only and just awaits navigator.serviceWorker.ready instead of
// registering again.
export default function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker
            .register("/service-worker.js", {
                scope: "/",
                updateViaCache: "none",
            })
            .then(registration => {
                window.addEventListener("online", () => {
                    registration.active?.postMessage({ type: "SYNC_QUEUE" });
                });
            })
            .catch(error => {
                console.error("Service Worker registration failed:", error);
            });
    }, []);

    return null;
}
