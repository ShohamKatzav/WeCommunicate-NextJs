"use client";

import { useEffect, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [dismissed, setDismissed] = useState(false);
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

    if (!showInstallButton || dismissed) return null;

    return (
        <>
            <div
                style={{
                    position: "fixed",
                    bottom: isMobile ? "10vh" : "5px",
                    right: isMobile ? "5px" : "15%",
                    zIndex: isMobile ? 10 : 100,
                    border: "3px solid yellow"
                }}
            >
                <button
                    onClick={() => setDismissed(true)}
                    style={{
                        position: "absolute",
                        top: "-8px",
                        right: "-8px",
                        background: "red",
                        color: "white",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        border: "none",
                        cursor: "pointer"
                    }}
                >
                    ×
                </button>
                <button
                    onClick={handleInstallClick}
                    className={`${isMobile ? "px-6 py-3" : "px-[2dvw] py-[1dvh] text-sm sm:text-base md:text-xl"} 
                                bg-black text-white rounded-lg text-base shadow-md cursor-pointer border-none`}>
                    Install App
                </button>
            </div>
        </>
    );
}