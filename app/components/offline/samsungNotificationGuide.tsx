'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePromptDismissal } from '../../hooks/usePromptDismissal';
import { useSocket } from '../../hooks/useSocket';

const PROMPT_ID = 'samsung-notification-popup';

type NavigatorWithUAData = Navigator & {
    userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
    };
};

// Galaxy model numbers start with SM- (an S26 is SM-S94x). Samsung Internet
// still says so in its user agent, but Chrome on Android has frozen the
// model in the user agent to "K" since Chrome 110 - there the model is
// only available through User-Agent Client Hints.
async function isSamsungDevice(): Promise<boolean> {
    if (/SamsungBrowser|SM-[A-Z0-9]/i.test(navigator.userAgent)) return true;
    try {
        const hints = await (navigator as NavigatorWithUAData).userAgentData?.getHighEntropyValues?.(['model']);
        return /^SM-/i.test(hints?.model ?? '');
    } catch {
        return false;
    }
}

// Same check InstallPrompt uses. Installed, the app has its own entry under
// Settings > Apps; in a Chrome tab its notifications belong to Chrome.
function isInstalledApp() {
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// One UI hides the per-category switch that actually allows a pop-up: the
// app-level "Notification pop-up" setting can already be on while
// notifications still only land in the shade. Shown once, after
// notification permission is granted.
export default function SamsungNotificationGuide() {
    const { suppressed, dismiss } = usePromptDismissal(PROMPT_ID);
    const { socket } = useSocket();
    const [open, setOpen] = useState(false);
    const [installed, setInstalled] = useState(true);
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (suppressed !== false) return;
        let cancelled = false;
        let status: PermissionStatus | undefined;

        const showIfGranted = () => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                setInstalled(isInstalledApp());
                setOpen(true);
            }
        };

        const start = async () => {
            if (!(await isSamsungDevice()) || cancelled) return;
            showIfGranted();
            // Enabling notifications happens in another component. The
            // Permissions API fires when that grant lands, so this dialog
            // opens then too, not only on a later visit.
            try {
                const next = await navigator.permissions.query({ name: 'notifications' });
                if (cancelled) return;
                status = next;
                status.addEventListener('change', showIfGranted);
            } catch {
                // Older browsers omit this permission name. A later visit,
                // once permission is already granted, still opens the dialog.
            }
        };
        void start();
        return () => {
            cancelled = true;
            status?.removeEventListener('change', showIfGranted);
        };
    }, [suppressed]);

    // A ringing call comes first - the backdrop would cover its card. Not
    // dismissed, so the steps come back on the next visit.
    useEffect(() => {
        if (!open || !socket) return;
        const hide = () => setOpen(false);
        socket.on('call invite', hide);
        return () => {
            socket.off('call invite', hide);
        };
    }, [open, socket]);

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        confirmRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                dismiss();
                setOpen(false);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [open, dismiss]);

    if (!open) return null;

    const close = () => {
        dismiss();
        setOpen(false);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="samsung-notification-title"
                aria-describedby="samsung-notification-body"
                className="max-h-[min(32rem,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        </div>
                        <h2 id="samsung-notification-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            Samsung keeps alerts in the shade
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Dismiss Samsung notification steps"
                        className="text-gray-500 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <p id="samsung-notification-body" className="mb-4 text-gray-700 dark:text-gray-300">
                    Notifications are on, but Samsung won&apos;t show calls and messages over the screen until you turn on a setting it hides by default.
                </p>
                <ol className="mb-6 list-decimal space-y-2 pl-5 text-gray-800 dark:text-gray-200">
                    <li>Open Settings, then Notifications, then Advanced settings, and turn on <strong>Manage notification categories for each app</strong>.</li>
                    {installed ? (
                        <>
                            <li>Go back to Settings, then Apps, then WeCommunicate, then Notifications.</li>
                            <li>Scroll down to Notification categories and tap <strong>General</strong>.</li>
                        </>
                    ) : (
                        <>
                            <li>Go back to Settings, then Apps, then Chrome, then Notifications.</li>
                            <li>Scroll down to Notification categories and tap <strong>{window.location.hostname}</strong> under Sites.</li>
                        </>
                    )}
                    <li>Turn on <strong>Show as pop-up</strong>.</li>
                </ol>
                <button
                    ref={confirmRef}
                    type="button"
                    onClick={close}
                    className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
