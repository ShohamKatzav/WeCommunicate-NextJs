"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    useEffect(() => {
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
            document.referrer.startsWith("android-app://");

        if (isStandalone) {
            setIsInstalled(true);
            setShowInstallButton(false);
            return;
        }

        const handler = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setShowInstallButton(true);
        };

        const onAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowInstallButton(false);
        };

        window.addEventListener("beforeinstallprompt", handler);
        window.addEventListener("appinstalled", onAppInstalled);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", onAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
            setIsInstalled(true);
        }

        setDeferredPrompt(null);
        setShowInstallButton(false);
    };

    if (!showInstallButton || dismissed || isInstalled) return null;

    return (
        <div className="fixed inset-x-0 bottom-2 z-[8] px-2 sm:px-4 md:bottom-3 md:z-40">
            <div className="mx-auto w-full max-w-md">
                <div className="relative flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/95 p-2 text-white shadow-lg backdrop-blur-sm">
                    <button
                        onClick={() => setDismissed(true)}
                        className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xs text-slate-100 hover:bg-slate-700"
                        aria-label="Dismiss install prompt"
                    >
                        x
                    </button>
                    <div className="min-w-0 flex-1 pl-1">
                        <p className="truncate text-xs text-slate-200 sm:text-sm">Install WeCommunicate for faster access</p>
                    </div>
                    <button
                        onClick={handleInstallClick}
                        className="shrink-0 rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-cyan-300 sm:px-4 sm:text-sm"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
}
