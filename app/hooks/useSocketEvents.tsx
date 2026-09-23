import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { usePathname } from 'next/navigation';
import ChatUser from '@/types/chatUser';
import Message from '@/types/message';
import { revalidateChatRoute } from '@/app/lib/chatActions';
import { useUser } from './useUser';
import { TYPING_EXPIRE_MS } from '../config/limits';

interface UseSocketEventsProps {
    socket: Socket | null;
    loadingSocket: boolean;
    userEmail?: string;
    handleIncomingMessage: (data: Message) => void;
    setChat: (messages: Message[]) => void;
    chatRef: React.RefObject<Message[]>;
    isLocalTypingRef: React.RefObject<boolean>;
    currentConversationId: React.RefObject<string>;
}

export const useSocketEvents = ({
    socket,
    loadingSocket,
    userEmail,
    handleIncomingMessage,
    setChat,
    chatRef,
    isLocalTypingRef,
    currentConversationId
}: UseSocketEventsProps) => {

    const [chatListActiveUsers, setChatListActiveUsers] = useState<ChatUser[]>([]);
    // conversationId -> emails typing there. Scoped per conversation so an
    // indicator from one chat can never show up in another's header.
    const [typingByConversation, setTypingByConversation] = useState<Record<string, Record<string, boolean>>>({});
    const typingExpiryTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    // Overrides whatever last-seen value the page was server-rendered with,
    // for anyone who has gone offline since it loaded.
    const [lastSeenByEmail, setLastSeenByEmail] = useState<Record<string, string>>({});
    const pathname = usePathname();

    useEffect(() => {
        if (!socket || loadingSocket) return;

        const onLastSeen = (data: { email?: string; lastSeen?: string }) => {
            if (!data?.email || !data.lastSeen) return;
            setLastSeenByEmail(prev => ({ ...prev, [data.email!.toLowerCase()]: data.lastSeen! }));
        };

        socket.on("user last seen", onLastSeen);

        return () => {
            socket.off("user last seen", onLastSeen);
        };
    }, [socket, loadingSocket]);

    useEffect(() => {
        if (!socket || loadingSocket) return;

        // conversationId|email -> the timer that drops that indicator if no
        // refresh arrives (see TYPING_EXPIRE_MS in limits.ts).
        const expiryTimers = typingExpiryTimers.current;
        const timerKey = (conversationId: string, email: string) => `${conversationId}|${email}`;

        const removeTyper = (conversationId: string, email: string) => {
            const key = timerKey(conversationId, email);
            clearTimeout(expiryTimers.get(key));
            expiryTimers.delete(key);
            setTypingByConversation(prev => {
                if (!prev[conversationId]?.[email]) return prev;
                const typers = { ...prev[conversationId] };
                delete typers[email];
                const next = { ...prev };
                if (Object.keys(typers).length > 0) next[conversationId] = typers;
                else delete next[conversationId];
                return next;
            });
        };

        const onStartTyping = (data: { email?: string; conversationId?: string }) => {
            const { email, conversationId } = data || {};
            if (!email || !conversationId) return;
            // This account typing in another of its own tabs isn't news.
            if (email.toLowerCase() === userEmail?.toLowerCase()) return;

            const key = timerKey(conversationId, email);
            clearTimeout(expiryTimers.get(key));
            expiryTimers.set(key, setTimeout(() => removeTyper(conversationId, email), TYPING_EXPIRE_MS));
            setTypingByConversation(prev => prev[conversationId]?.[email]
                ? prev
                : { ...prev, [conversationId]: { ...prev[conversationId], [email]: true } });
        };

        const onStopTyping = (data: { email?: string; conversationId?: string }) => {
            const { email, conversationId } = data || {};
            if (!email || !conversationId) return;
            removeTyper(conversationId, email);
        };

        const onSyncRequest = () => {
            // Check the Ref from useChatRoom
            if (isLocalTypingRef.current && currentConversationId.current) {
                socket.emit('start typing', { conversationId: currentConversationId.current });
            }
        };

        socket.on("start typing", onStartTyping);
        socket.on("stop typing", onStopTyping);
        socket.on("request typing status", onSyncRequest);

        return () => {
            socket.off("start typing", onStartTyping);
            socket.off("stop typing", onStopTyping);
            socket.off("request typing status", onSyncRequest);
            expiryTimers.forEach(timer => clearTimeout(timer));
            expiryTimers.clear();
        };
    }, [socket, loadingSocket, userEmail, isLocalTypingRef, currentConversationId]);

    // Connected users
    useEffect(() => {
        if (!socket) return;

        const handler = (data: ChatUser[]) => {
            setChatListActiveUsers(data);
        };

        const onConnect = () => {
            socket.off('update connected users', handler);
            socket.on('update connected users', handler);
            socket.emit('update connected users');
        };

        try {
            if (!loadingSocket) {
                onConnect();
            } else {
                socket.off('connect', onConnect);
                socket.on('connect', onConnect);
            }
        } catch (e) {
            console.error('[client] socket attach error', e);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('update connected users', handler);
        };
    }, [socket, loadingSocket, pathname]);

    // Incoming messages
    // Note: we intentionally do NOT gate this on socket.connected. It's a
    // plain mutable property, not React state, so React never re-runs this
    // effect when it flips - if the component mounts before the handshake
    // completes, the listener would never get attached. socket.io queues
    // .on() registrations regardless of connection state, so this is safe.
    useEffect(() => {
        if (!socket || loadingSocket) return;

        socket.on("publish message", handleIncomingMessage);

        return () => {
            socket.off("publish message", handleIncomingMessage);
        };
    }, [socket, loadingSocket, handleIncomingMessage]);

    // Message deletion
    useEffect(() => {
        if (!socket || loadingSocket) return;

        const handleMessageDeleted = async (deletedMessage: Message) => {
            setChat(
                chatRef.current.map(msg =>
                    msg._id === deletedMessage._id
                        ? { ...msg, status: 'revoked' }
                        : msg
                )
            );

            try {
                await revalidateChatRoute();
            } catch (error) {
                console.error("Error revalidating chat route:", error);
            }
        };

        socket.on("delete message", handleMessageDeleted);

        return () => {
            socket.off("delete message", handleMessageDeleted);
        };
    }, [socket, loadingSocket, setChat, chatRef]);

    // Read receipts
    useEffect(() => {
        if (!socket || loadingSocket) return;

        const handleMessagesRead = () => {
            // This event only reaches clients that have this exact
            // conversation's room open, so every message currently in
            // chatRef belongs to it - no per-message conversationId check
            // needed. The server already excludes the reader's own
            // messages, so this only ever marks messages *I* sent as read.
            setChat(
                chatRef.current.map(msg =>
                    msg.sender?.toUpperCase() === userEmail?.toUpperCase() && msg.status !== 'revoked'
                        ? { ...msg, status: 'read' }
                        : msg
                )
            );
        };

        socket.on("messages read", handleMessagesRead);

        return () => {
            socket.off("messages read", handleMessagesRead);
        };
    }, [socket, loadingSocket, setChat, chatRef, userEmail]);
    return {
        chatListActiveUsers,
        typingByConversation,
        lastSeenByEmail
    };
};