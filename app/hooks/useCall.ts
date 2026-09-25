'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Socket } from 'socket.io-client';
import { CallController, CallControllerHooks, IDLE_CALL_SNAPSHOT } from '../lib/callController';

interface UseCallProps extends CallControllerHooks {
    socket: Socket | null;
    userEmail?: string;
}

const noopUnsubscribe = () => { };

// One CallController per socket for the lifetime of the chat page. The
// callbacks are read through a ref so a re-render (or a server refresh that
// hands down a new iceServers array) never tears down a live call.
export const useCall = ({ socket, userEmail, ...hooks }: UseCallProps) => {
    const hooksRef = useRef<CallControllerHooks>(hooks);
    useEffect(() => {
        hooksRef.current = hooks;
    });

    const [controller, setController] = useState<CallController | null>(null);

    useEffect(() => {
        if (!socket || !userEmail) return;

        const instance = new CallController(socket, userEmail, {
            getIceServers: () => hooksRef.current.getIceServers(),
            resolvePeer: email => hooksRef.current.resolvePeer(email),
            getCurrentConversationId: () => hooksRef.current.getCurrentConversationId(),
            openConversation: (conversationId, peerEmail) => hooksRef.current.openConversation(conversationId, peerEmail),
            onError: message => hooksRef.current.onError(message),
            t: () => hooksRef.current.t(),
            onMissedCall: peer => hooksRef.current.onMissedCall(peer),
        });
        setController(instance);

        // Reloading or closing the tab hangs up (and releases the camera)
        // instead of leaving the other side on a frozen call until the
        // server notices the socket is gone.
        const onPageHide = () => instance.endActiveCall();
        window.addEventListener('pagehide', onPageHide);

        return () => {
            window.removeEventListener('pagehide', onPageHide);
            instance.destroy();
            setController(null);
        };
    }, [socket, userEmail]);

    const subscribe = useCallback(
        (listener: () => void) => controller ? controller.subscribe(listener) : noopUnsubscribe,
        [controller]
    );
    const getSnapshot = useCallback(
        () => controller ? controller.getSnapshot() : IDLE_CALL_SNAPSHOT,
        [controller]
    );
    const call = useSyncExternalStore(subscribe, getSnapshot, () => IDLE_CALL_SNAPSHOT);

    return { call, controller };
};
