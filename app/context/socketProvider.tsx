"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import io, { Socket } from 'socket.io-client';
import { useUser } from "../hooks/useUser";
import SocketContext from "./socketContext";
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useT } from '../i18n/client';

type SocketProviderProps = {
    children: ReactNode;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
    const baseAddress = process.env.NEXT_PUBLIC_BASE_ADDRESS as string;
    const { user, loadingUser, updateUser, refreshUser } = useUser();
    // Read from a ref by the socket handlers below, so a language switch
    // doesn't tear down and reconnect the socket just to reword a toast.
    const t = useT();
    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; });
    const [socket, setSocket] = useState<Socket | null>(null);
    const [loadingSocket, setLoadingSocket] = useState(true);
    const router = useRouter();
    const socketRef = useRef<Socket | null>(null);
    const removeListenersRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!loadingUser && user?.email) {
            const setUp = () => {
                const socketConfig = {
                    extraHeaders: {
                        "email": user.email as string
                    },
                    autoConnect: false,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 10000,
                    reconnectionDelayMax: 10000,
                    path: "/api/socket",
                    auth: {
                        token: user?.token
                    }
                }
                const newSocket = io(baseAddress, socketConfig);
                socketRef.current = newSocket;
                newSocket.on('unauthorized', () => {
                    router.push('/');
                    updateUser(null);
                    setSocket(null);
                    setLoadingSocket(false);
                });
                newSocket.on("banned", async (data) => {
                    setSocket(null);
                    newSocket.disconnect();
                    await updateUser(null);
                    router.push('/login');
                    setLoadingSocket(false);
                    toast.error(
                        data.message || tRef.current("moderation.accountBanned"),
                        { duration: 10000 }
                    );
                });
                // A moderator just promoted or demoted this user. Only a hint:
                // the flag itself comes from re-reading the account, so the
                // Moderator links (navbar, footer) appear or go, and a demoted
                // user on /moderator is sent on to /chat by that page.
                newSocket.on('moderator status changed', () => {
                    refreshUser();
                });
                // The server pushes an incoming call unless one of the user's
                // tabs is on screen - a phone keeps a backgrounded or locked
                // tab's socket connected for minutes, and that tab can't show
                // the call. Only sent while connected: an emit while offline
                // is buffered and would go out after the fresh one from
                // 'connect'. (Not volatile - that drops the packet whenever
                // the polling transport is mid-request, as it is on connect.)
                const reportVisibility = (visible = document.visibilityState === 'visible') => {
                    if (newSocket.connected) newSocket.emit('app visibility', visible);
                };
                // After reconnectionAttempts run out, Socket.IO stops trying
                // for good; coming back to the app (or back online) starts it
                // again, so a tab left open doesn't quietly stop receiving
                // calls and messages. `active` is false after a deliberate
                // disconnect (ours, or the server kicking this socket).
                const reconnectIfDropped = () => {
                    if (!newSocket.connected && newSocket.active) newSocket.connect();
                };
                const onVisibilityChange = () => {
                    reportVisibility();
                    if (document.visibilityState === 'visible') reconnectIfDropped();
                };
                // pagehide can come before visibilitychange, and a closed
                // tab's disconnect reaches the server late.
                const onPageHide = () => reportVisibility(false);
                const onConnect = () => reportVisibility();
                newSocket.on('connect', onConnect);
                document.addEventListener('visibilitychange', onVisibilityChange);
                window.addEventListener('pagehide', onPageHide);
                window.addEventListener('online', reconnectIfDropped);
                removeListenersRef.current = () => {
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                    window.removeEventListener('pagehide', onPageHide);
                    window.removeEventListener('online', reconnectIfDropped);
                };

                newSocket.connect();
                setSocket(newSocket);
                setLoadingSocket(false);
            }
            setUp();
        }
        return () => {
            removeListenersRef.current?.();
            removeListenersRef.current = null;
            socketRef.current?.disconnect();
            socketRef.current = null;
        };

    }, [user?.token, user?.email, loadingUser]);

    return (
        <SocketContext.Provider key={user?.token || 'guest'} value={{ socket, loadingSocket }}>
            {children}
        </SocketContext.Provider>
    );
}