import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { usePathname } from 'next/navigation';
import ChatUser from '@/types/chatUser';
import Message from '@/types/message';
import { revalidateChatRoute } from '@/app/lib/chatActions';
import { useUser } from './useUser';

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
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
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

        const onStartTyping = (data: { email: string }) => {
            setTypingUsers(prev => ({ ...prev, [data.email]: true }));
        };

        const onStopTyping = (data: { email: string }) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[data.email];
                return newState;
            });
        };

        const onSyncRequest = () => {
            // Check the Ref from useChatRoom
            if (isLocalTypingRef.current && currentConversationId.current) {
                socket.emit('start typing', {
                    email: userEmail,
                    conversationId: currentConversationId.current
                });
            }
        };

        socket.on("start typing", onStartTyping);
        socket.on("stop typing", onStopTyping);
        socket.on("request typing status", onSyncRequest);

        return () => {
            socket.off("start typing", onStartTyping);
            socket.off("stop typing", onStopTyping);
            socket.off("request typing status", onSyncRequest);
        };
    }, [socket, loadingSocket, userEmail]);

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
        typingUsers,
        lastSeenByEmail
    };
};