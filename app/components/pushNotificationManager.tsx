'use client'

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiBell, FiX } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import urlBase64ToUint8Array from '@/app/utils/urlBase64ToUint8Array'
import { subscribeUser, unsubscribeUser } from '@/app/lib/pushActions'
import { useUser } from '../hooks/useUser';
import useIsMobile from '../hooks/useIsMobile';
import { BOTTOM_PROMPT_STACK_ID } from './bottomPromptStack';

// Push notifications are triggered server-side (see saveMessage in
// chatActions.ts) right after a message is persisted, rather than from
// here - a client-driven send never fires if the sender closes the tab
// right after hitting send. This component only manages the subscription.

const SOFT_ASK_DISMISSED_KEY = 'pushNotificationSoftAskDismissed';

export default function PushNotificationManager() {
    const { loadingUser } = useUser();
    const isMobile = useIsMobile();
    // null = not yet determined. Browser support can't be known during SSR
    // (there's no navigator/window on the server), so defaulting this to
    // false would render the "not supported" message on every load, even in
    // browsers that do support it, until the effect below corrects it.
    const [isSupported, setIsSupported] = useState<boolean | null>(null)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [showSoftAsk, setShowSoftAsk] = useState(false);
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

            if (!sub && localStorage.getItem(SOFT_ASK_DISMISSED_KEY) !== 'true') {
                setShowSoftAsk(true);
            }

            window.addEventListener('online', () => {
                registration.active?.postMessage({ type: 'SYNC_QUEUE' });
            });
        } catch (error) {
            console.error("Service Worker registration failed:", error);
        }
    }

    async function subscribeToPush() {
        setShowSoftAsk(false);

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
            localStorage.removeItem(SOFT_ASK_DISMISSED_KEY);
        } catch (error) {
            console.error("Subscription failed:", error);
        }
    }

    async function unsubscribeFromPush() {
        await subscription?.unsubscribe()
        setSubscription(null)
        await unsubscribeUser()
        setShowSoftAsk(true);
    }

    const handleSoftAskLater = () => {
        setShowSoftAsk(false);
    };

    const handleSoftAskDismiss = () => {
        setShowSoftAsk(false);
        localStorage.setItem(SOFT_ASK_DISMISSED_KEY, 'true');
    };

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


    if (isSupported === null) {
        // Not yet determined - render nothing rather than flash the wrong
        // message while we wait for the effect above to run.
        return null;
    }

    if (!isSupported) {
        // Nothing to offer and nothing the reader can do about it (Safari only
        // exposes push to an installed PWA), so this says nothing rather than
        // permanently occupying a prompt slot that shortens the chat.
        return null;
    }

    const banner = (
        <>
            {subscription ? (
                <div
                    className="pointer-events-auto w-full max-w-md p-3 shadow-md rounded-lg flex items-center bg-green-600 text-white transition-all duration-300"
                >
                    <FaCheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className='text-sm font-medium'>Notifications Enabled</span>
                    <button
                        onClick={unsubscribeFromPush}
                        className='ml-4 text-xs underline font-bold hover:text-green-800 transition-colors'
                    >
                        Unsubscribe
                    </button>
                </div>
            ) : (
                showSoftAsk && (
                    <div
                        className="pointer-events-auto w-full max-w-md p-4 shadow-2xl rounded-lg bg-blue-600 text-white transition-all duration-300"
                        role="alert"
                    >
                        <div className="hidden md:flex md:items-start md:justify-between">
                            <div className="flex items-start flex-1">
                                <FiBell className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                                <p className="text-sm font-medium flex-grow">
                                    Get instant alerts for new messages.
                                </p>
                            </div>

                            <button
                                onClick={handleSoftAskDismiss}
                                className="ml-3 p-1 rounded-full hover:bg-blue-700 transition-colors flex-shrink-0"
                                aria-label="Permanently dismiss notification prompt"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="md:hidden">
                            <div className="flex items-start mb-3">
                                <FiBell className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                                <p className="text-sm font-medium flex-grow">
                                    Get instant alerts for new messages.
                                </p>
                                <button
                                    onClick={handleSoftAskDismiss}
                                    className="ml-3 p-1 rounded-full hover:bg-blue-700 transition-colors flex-shrink-0"
                                    aria-label="Permanently dismiss notification prompt"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center justify-start gap-3">
                                <button
                                    onClick={subscribeToPush}
                                    className="bg-white text-blue-600 px-5 py-1.5 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors shadow-md"
                                >
                                    Enable
                                </button>
                                <button
                                    onClick={handleSoftAskLater}
                                    className="text-white text-sm font-medium hover:underline transition-all px-2 py-1.5"
                                >
                                    Later
                                </button>
                            </div>
                        </div>

                        <div className="hidden md:flex md:items-center md:justify-start md:gap-3 md:mt-3">
                            <button
                                onClick={subscribeToPush}
                                className="bg-white text-blue-600 px-5 py-1.5 rounded-full font-bold text-sm hover:bg-gray-100 transition-colors shadow-md"
                            >
                                Enable
                            </button>
                            <button
                                onClick={handleSoftAskLater}
                                className="text-white text-sm font-medium hover:underline transition-all px-2 py-1"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                )
            )}
        </>
    );

    // Rendered into the shared bottom stack rather than here: this component is
    // mounted inside the chat's flex row (it registers the service worker from
    // there), so anything it returned in place became a phantom column beside
    // the conversation.
    return promptStack ? createPortal(banner, promptStack) : null;
}