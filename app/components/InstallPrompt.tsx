"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import PromptBar from "./promptBar";
import { usePromptDismissal } from "../hooks/usePromptDismissal";
import { usePromptSlot } from "../hooks/usePromptSlot";

const PROMPT_ID = "install";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const { suppressed, dismiss } = usePromptDismissal(PROMPT_ID);

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

    const wantsToShow = showInstallButton && suppressed === false && !isInstalled;
    const { isCurrent, queuedBehind } = usePromptSlot(PROMPT_ID, wantsToShow);

    if (!isCurrent) return null;

    return (
        // Positioning belongs to BottomPromptStack, which reserves room for this
        // instead of letting it float over the composer.
        <PromptBar
            icon={<Download className="h-5 w-5 text-cyan-300" />}
            message="Install WeCommunicate for faster access"
            primaryAction={{ label: "Install", onClick: handleInstallClick }}
            onDismiss={dismiss}
            dismissLabel="Dismiss install prompt"
            queuedCount={queuedBehind}
            accentClassName="bg-slate-900/95 text-white backdrop-blur-sm"
        />
    );
}
