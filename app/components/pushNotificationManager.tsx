'use client'

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import urlBase64ToUint8Array from '@/app/utils/urlBase64ToUint8Array'
import { subscribeUser, unsubscribeUser } from '@/app/lib/pushActions'
import { useUser } from '../hooks/useUser';
import { usePromptDismissal } from '../hooks/usePromptDismissal';
import { usePromptSlot } from '../hooks/usePromptSlot';
import PromptBar from './promptBar';
import { BOTTOM_PROMPT_STACK_ID } from './bottomPromptStack';

// Push notifications are triggered server-side (see saveMessage in
// chatActions.ts) right after a message is persisted, rather than from
// here - a client-driven send never fires if the sender closes the tab
// right after hitting send. This component only manages the subscription.

const PROMPT_ID = "push-soft-ask";

export default function PushNotificationManager() {
    const { loadingUser } = useUser();
    // null = not yet determined. Browser support can't be known during SSR
    // (there's no navigator/window on the server), so defaulting this to
    // false would render the "not supported" message on every load, even in
    // browsers that do support it, until the effect below corrects it.
    const [isSupported, setIsSupported] = useState<boolean | null>(null)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const { suppressed, dismiss, snooze } = usePromptDismissal(PROMPT_ID);
    // Looked up after mount because the stack is rendered by the root layout and
    // there is no DOM to portal into while this renders on the server.
    const [promptStack, setPromptStack] = useState<HTMLElement | null>(null);

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register("/service-worker.js", {
                type: 'module',
                scope: '/',
                updateViaCache: 'none',
            });

            const sub = await registration.pushManager.getSubscription();
            setSubscription(sub);

            window.addEventListener('online', () => {
                registration.active?.postMessage({ type: 'SYNC_QUEUE' });
            });
        } catch (error) {
            console.error("Service Worker registration failed:", error);
        }
    }

    async function subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
                ),
            })
            setSubscription(sub)
            const serializedSub = JSON.parse(JSON.stringify(sub))
            await subscribeUser(serializedSub)
            toast.success('Notifications enabled');
        } catch (error) {
            console.error("Subscription failed:", error);
            toast.error("Couldn't enable notifications. Please try again.");
            // Snoozed, not dismissed: a failed attempt (permission blocked,
            // browser support gap, network hiccup) shouldn't nag again this
            // session, but the user never said "stop asking forever" either -
            // that's still only what the X does.
            snooze();
        }
    }

    async function unsubscribeFromPush() {
        await subscription?.unsubscribe()
        setSubscription(null)
        await unsubscribeUser()
        toast.info('Notifications turned off');
    }

    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setIsSupported(supported);
        if (supported && !loadingUser) {
            registerServiceWorker();
        }
    }, [loadingUser]);

    useEffect(() => {
        setPromptStack(document.getElementById(BOTTOM_PROMPT_STACK_ID));
    }, []);

    // Confirmation ("Notifications Enabled") and the failure case above are
    // one-off events, not something to ask the user about again later, so
    // they're a sonner toast rather than a slot in the persistent queue below
    // - that queue is only for prompts the user might still need to act on.
    const wantsToShow = isSupported === true && !subscription && suppressed === false;
    const { isCurrent, queuedBehind } = usePromptSlot(PROMPT_ID, wantsToShow);

    if (!isCurrent || !promptStack) return null;

    const banner = (
        <PromptBar
            icon={<Bell className="h-5 w-5" />}
            message="Get instant alerts for new messages"
            primaryAction={{ label: "Enable", onClick: subscribeToPush }}
            secondaryAction={{ label: "Later", onClick: snooze }}
            onDismiss={dismiss}
            dismissLabel="Permanently dismiss notification prompt"
            queuedCount={queuedBehind}
            accentClassName="bg-blue-600 text-white"
        />
    );

    // Rendered into the shared bottom stack rather than here: this component is
    // mounted inside the chat's flex row (it registers the service worker from
    // there), so anything it returned in place became a phantom column beside
    // the conversation.
    return createPortal(banner, promptStack);
}
