"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import PromptBar from "./promptBar";
import { usePromptDismissal } from "../hooks/usePromptDismissal";
import { usePromptSlot } from "../hooks/usePromptSlot";
import { isSamsungInternet } from "../utils/samsungInternet";

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

// Chromium-only and behind a flag on most channels, so this is a bonus signal,
// not something either branch below can assume exists.
interface NavigatorWithRelatedApps extends Navigator {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform: string; url?: string }>>;
}

// The manual "open your menu and Add to Home Screen" fallback only makes
// sense on a browser that genuinely never fires beforeinstallprompt. On
// Chromium (Chrome/Edge desktop and Android) the event simply hasn't fired
// yet - install criteria not met, or a signal the fallback timer can't see -
// and showing manual instructions there is misleading, not helpful.
function isIOSDevice(navigator: Navigator): boolean {
    return (
        /iP(hone|od|ad)/.test(navigator.userAgent) ||
        // iPadOS 13+ reports as "Macintosh" but is touch-capable, unlike a
        // real Mac.
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}

function neverFiresBeforeInstallPrompt(navigator: Navigator): boolean {
    const isFirefox = /firefox/i.test(navigator.userAgent);
    return isIOSDevice(navigator) || isFirefox || isSamsungInternet(navigator.userAgent);
}

type ManualInstallPlatform = "ios" | "samsung" | "other";

// iOS has no "Add to Home Screen" in a browser menu - in Safari (and, since
// iOS 16.4, Chrome/Edge/Firefox on iOS too) it lives in the Share sheet, so
// the generic "open your browser menu" wording sent people looking in the
// wrong place.
function manualInstallMessage(platform: ManualInstallPlatform): string {
    if (platform === "ios") return "Install WeCommunicate: tap Share, then Add to Home Screen";
    if (platform === "samsung") return "Samsung: menu → Add page to → Home screen";
    return "Install WeCommunicate: open your browser menu and choose Add to Home screen";
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showManualFallback, setShowManualFallback] = useState(false);
    const [manualPlatform, setManualPlatform] = useState<ManualInstallPlatform>("other");
    const [canFallBackToManualInstall, setCanFallBackToManualInstall] = useState(false);
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

        setManualPlatform(
            isIOSDevice(window.navigator) ? "ios" : isSamsungInternet(window.navigator.userAgent) ? "samsung" : "other"
        );
        setCanFallBackToManualInstall(neverFiresBeforeInstallPrompt(window.navigator));

        if (isStandalone) {
            setIsInstalled(true);
            setShowInstallButton(false);
            return;
        }

        // Chrome (and other Chromium browsers) generally don't fire
        // beforeinstallprompt once the app is already installed, which used
        // to leave gotBeforeInstallPromptRef false forever and let the 4s
        // fallback below wrongly conclude "never fires here, show manual
        // install" for a visitor who already has it. Ask directly where the
        // browser supports it; isInstalled below is reactive, so this can
        // resolve after the fallback timer already fired and still hide it.
        const relatedAppsNavigator = window.navigator as NavigatorWithRelatedApps;
        if (typeof relatedAppsNavigator.getInstalledRelatedApps === "function") {
            relatedAppsNavigator
                .getInstalledRelatedApps()
                .then((apps) => {
                    if (apps.length > 0) {
                        setIsInstalled(true);
                        setShowInstallButton(false);
                    }
                })
                .catch(() => {
                    // Unsupported in this build/flag state - fall through to
                    // the normal beforeinstallprompt/fallback flow below.
                });
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
    // never both want the slot at once. canFallBackToManualInstall keeps this
    // off Chromium: there, "hasn't fired yet" usually just means the
    // installability criteria aren't met (or it's already installed, handled
    // by isInstalled), not that manual instructions would help.
    const wantsManualFallback =
        !showInstallButton && showManualFallback && canFallBackToManualInstall && fallbackSuppressed === false && !isInstalled;
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
                message={manualInstallMessage(manualPlatform)}
                onDismiss={dismissFallback}
                dismissLabel="Dismiss install instructions"
                queuedCount={fallbackQueuedBehind}
                accentClassName="bg-slate-900/95 text-white backdrop-blur-sm"
            />
        );
    }

    return null;
}
