'use client'

import { useState, useEffect, useCallback } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { FaCheckCircle } from 'react-icons/fa';
import urlBase64ToUint8Array from '@/app/utils/urlBase64ToUint8Array'
import { subscribeUser, unsubscribeUser, sendNotification } from '@/app/lib/pushActions'
import { useUser } from '../hooks/useUser';
import useIsMobile from '../hooks/useIsMobile';
import Message from '@/types/message';
import ChatUser from '@/types/chatUser'
import { getUsersByEmails } from '@/app/lib/accountActions';

interface PushNotificationManagerProps {
    message: Message;
    activeSocketUsers: ChatUser[];
}

const SOFT_ASK_DISMISSED_KEY = 'pushNotificationSoftAskDismissed';

export default function PushNotificationManager({ message, activeSocketUsers }: PushNotificationManagerProps) {
    const { user, loadingUser } = useUser();
    const isMobile = useIsMobile();
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [sendingMessage, setSendingMessage] = useState(false)
    const [showSoftAsk, setShowSoftAsk] = useState(false);

    const handlePushNotification = useCallback(async () => {
        if (!subscription || sendingMessage) return;
        if (!message.participantID || message.participantID.length === 0) return;
        try {
            const activeUserEmails = activeSocketUsers.map(a => a.email);
            const activeUsersIDS = (await getUsersByEmails(activeUserEmails as string[])).map((a: any) => a._id.toLowerCase());
            const offlineParticipants = message.participantID.filter(
                participantId => !activeUsersIDS.includes(participantId.toLowerCase())
            );
            // All participants are online, skipping push notification
            if (offlineParticipants.length === 0) {
                return;
            }
            setSendingMessage(true);
            const messageForOfflineUsers = {
                ...message,
                participantID: offlineParticipants
            };
            await sendNotification(messageForOfflineUsers);
        } catch (error) {
            console.error("Failed to send notification:", error);
        } finally {
            setSendingMessage(false);
        }
    }, [subscription, sendingMessage, message]);

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
            await subscribeUser(serializedSub, user?.email as string)
            localStorage.removeItem(SOFT_ASK_DISMISSED_KEY);
        } catch (error) {
            console.error("Subscription failed:", error);
        }
    }

    async function unsubscribeFromPush() {
        await subscription?.unsubscribe()
        setSubscription(null)
        await unsubscribeUser(user?.email as string)
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
        if (subscription && message.participantID) {
            handlePushNotification();
        }
    }, [message._id, subscription]);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
        }
        if (isSupported && !loadingUser) {
            registerServiceWorker();
        }
    }, [isSupported, loadingUser]);


    if (!isSupported) {
        return <p className="text-center text-sm text-gray-500 dark:text-gray-400 p-2">Push notifications are not supported in this browser.</p>
    }

    return (
        <div className="relative">
            {subscription ? (
                <div
                    className={`fixed p-3 shadow-md rounded-lg flex items-center bg-green-600 text-white transition-all duration-300 transform md:max-w-xs z-[10] md:z-[100]
                        ${isMobile ? 'bottom-4 right-2' : 'bottom-4 left-4'}`}
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
                        className={`fixed p-4 shadow-2xl rounded-lg bg-blue-600 text-white transition-all duration-300 transform z-[10] md:z-[100]
                            ${isMobile
                                ? 'bottom-1 left-2 right-2'
                                : 'bottom-4 left-4 md:max-w-md'
                            }`}
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
        </div>
    )
}