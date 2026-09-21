"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import PromptBar from "./promptBar";
import { usePromptDismissal } from "../hooks/usePromptDismissal";
import { usePromptSlot } from "../hooks/usePromptSlot";

const PROMPT_ID = "install";
// Separate id from PROMPT_ID: dismissing "you can install this" (the manual
// fallback below) must not also permanently hide the real one-tap prompt for
// a visitor who later opens this same page in Chrome, and vice versa.
const FALLBACK_PROMPT_ID = "install-fallback";
// Chrome/Edge fire beforeinstallprompt within a beat of the page meeting the
// installability criteria. Waiting this long before assuming a browser never
// will (Samsung Internet, Firefox Android, iOS Safari all never fire it)
// keeps this from flashing the manual fallback on a browser that does
// support the automatic prompt but just hasn't fired it yet.
const FALLBACK_DELAY_MS = 4000;

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showManualFallback, setShowManualFallback] = useState(false);
    // Read inside the fallback timer instead of showInstallButton state - the
    // timer closure is captured once, on mount, so it must not depend on a
    // state value that can still change after that.
    const gotBeforeInstallPromptRef = useRef(false);
    const { suppressed, dismiss } = usePromptDismissal(PROMPT_ID);
    const { suppressed: fallbackSuppressed, dismiss: dismissFallback } = usePromptDismissal(FALLBACK_PROMPT_ID);

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
            gotBeforeInstallPromptRef.current = true;
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

        const fallbackTimer = window.setTimeout(() => {
            if (!gotBeforeInstallPromptRef.current) setShowManualFallback(true);
        }, FALLBACK_DELAY_MS);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", onAppInstalled);
            window.clearTimeout(fallbackTimer);
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

    // Mutually exclusive with wantsToShow above (this only turns on once the
    // timer decides beforeinstallprompt isn't coming), so the two prompts
    // never both want the slot at once.
    const wantsManualFallback = !showInstallButton && showManualFallback && fallbackSuppressed === false && !isInstalled;
    const { isCurrent: isFallbackCurrent, queuedBehind: fallbackQueuedBehind } = usePromptSlot(FALLBACK_PROMPT_ID, wantsManualFallback);

    if (isCurrent) {
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

    if (isFallbackCurrent) {
        return (
            <PromptBar
                icon={<Download className="h-5 w-5 text-cyan-300" />}
                message="Install WeCommunicate: open your browser menu and choose Add to Home screen"
                onDismiss={dismissFallback}
                dismissLabel="Dismiss install instructions"
                queuedCount={fallbackQueuedBehind}
                accentClassName="bg-slate-900/95 text-white backdrop-blur-sm"
            />
        );
    }

    return null;
}
