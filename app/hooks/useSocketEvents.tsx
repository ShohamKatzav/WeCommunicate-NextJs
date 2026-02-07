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
    const pathname = usePathname();

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
    useEffect(() => {
        if (!socket || loadingSocket || !socket.connected) return;

        socket.on("publish message", handleIncomingMessage);

        return () => {
            socket.off("publish message", handleIncomingMessage);
        };
    }, [socket, loadingSocket, socket?.connected, handleIncomingMessage]);

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
    return {
        chatListActiveUsers,
        typingUsers
    };
};