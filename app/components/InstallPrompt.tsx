"use client";

import { useEffect, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        const handler = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later
            setDeferredPrompt(e);
            // Update UI to show install button
            setShowInstallButton(true);
        };

        window.addEventListener("beforeinstallprompt", handler);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            return;
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        setDeferredPrompt(null);
        setShowInstallButton(false);
    };

    if (!showInstallButton) {
        return null;
    }

    return (
        <div
            style={{
                position: "fixed",
                bottom: isMobile ? "85px" : "10px",
                right: isMobile ? "5px" : "15%",
                zIndex: isMobile ? 10 : 100,
                border: "3px solid yellow"
            }}
        >
            <button
                onClick={handleInstallClick}
                style={{
                    padding: "12px 24px",
                    backgroundColor: "#000",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                }}
            >
                Install App
            </button>
        </div>
    );
}