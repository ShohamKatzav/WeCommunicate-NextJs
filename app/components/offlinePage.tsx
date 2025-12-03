"use client"
import { useState, useEffect } from "react";

export default function OfflinePage() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    if (isOnline) return null; // optional: could redirect back

    return (
        <div style={{ textAlign: "center", marginTop: "50px" }}>
            <h1>You are offline</h1>
            <p>Sorry, this page is unavailable while offline.</p>
            <p>Check your connection and try again.</p>
        </div>
    );
}