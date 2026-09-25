"use client"
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./useUser";
import { useSocket } from "./useSocket";

// Asks the service worker to do something and waits (briefly) for it -
// a worker that never answers mustn't hold up signing out.
const tellServiceWorker = (type: string) => new Promise<void>(resolve => {
    const controller = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker.controller
        : null;
    if (!controller) return resolve();
    try {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => {
            channel.port1.close();
            resolve();
        }, 1000);
        channel.port1.onmessage = () => {
            clearTimeout(timeout);
            channel.port1.close();
            resolve();
        };
        controller.postMessage({ type }, [channel.port2]);
    } catch (error) {
        console.error(`Service worker ${type} error:`, error);
        resolve();
    }
});

// Signing out, shared by the navbar's Log out and account deletion: drop the
// socket, clear the user (which deletes the session cookie and this device's
// push subscription - see userProvider.tsx), clear the service worker's
// cached pages, then leave. Account deletion also empties the offline outbox,
// since nothing in it can be sent any more.
export const useLogOut = () => {
    const { updateUser } = useUser();
    const { socket } = useSocket();
    const router = useRouter();

    return useCallback(async ({ destination = '/login', clearOutbox = false }: { destination?: string; clearOutbox?: boolean } = {}) => {
        try {
            if (socket?.connected) {
                socket.disconnect();
            }
            await updateUser(null);
            await tellServiceWorker('CLEAR_CACHE');
            if (clearOutbox) await tellServiceWorker('CLEAR_QUEUE');
        } catch (error) {
            console.error('Logout error:', error);
        }
        router.push(destination);
    }, [socket, updateUser, router]);
};
