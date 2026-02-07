import { useCallback, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import Message from '@/types/message';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';

interface UseChatRoomProps {
    socket: Socket | null;
    userEmail?: string;
    initialConversations: Conversation[];
    conversationsForBar: Conversation[];
    setMobileChatsSidebarOpen: (value: boolean) => void;
    setMobileUsersSidebarOpen: (value: boolean) => void;
}

export const useChatRoom = ({
    socket,
    userEmail,
    initialConversations,
    conversationsForBar,
    setMobileChatsSidebarOpen,
    setMobileUsersSidebarOpen
}: UseChatRoomProps) => {
    const [chat, setChat] = useState<Message[]>([]);
    const [messageToSend, setMessageToSend] = useState<Message>({ text: '' });

    const currentConversationId = useRef<string>("");
    const participants = useRef<ChatUser[] | null>(null);
    const chatRef = useRef<Message[]>(chat);

    const isLocalTypingRef = useRef<boolean>(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTyping = useCallback(() => {
        if (!currentConversationId.current || !socket) return;

        // If we weren't already typing, tell the server
        if (!isLocalTypingRef.current) {
            isLocalTypingRef.current = true;
            socket.emit('start typing', {
                conversationId: currentConversationId.current,
                email: userEmail
            });
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            isLocalTypingRef.current = false;
            socket.emit('stop typing', {
                conversationId: currentConversationId.current,
                email: userEmail
            });
        }, 3000);
    }, [socket, userEmail]);

    const updateChatRef = useCallback((newChat: Message[]) => {
        chatRef.current = newChat;
        setChat(newChat);
    }, []);

    const findConversationByExactParticipants = useCallback(
        (conversations: Conversation[], roomParticipants: ChatUser[]) => {
            const targetIds = roomParticipants.map(p => p._id).sort();

            return conversations.find(conv => {
                const targetMembers = conv.members.filter(member =>
                    member.email?.toUpperCase() !== userEmail?.toUpperCase()
                );
                const convMembersIds = targetMembers.map(m => m._id).sort();

                if (convMembersIds.length !== targetIds.length) return false;
                return convMembersIds.every((id, i) => id === targetIds[i]);
            });
        },
        [userEmail]
    );

    const getLastMessages = useCallback(async (roomParticipants: ChatUser[]) => {
        if (!roomParticipants) return;

        if (currentConversationId.current) {
            socket?.emit('leave room', { conversationId: currentConversationId.current });
            isLocalTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
        let conversation = findConversationByExactParticipants(conversationsForBar, roomParticipants);
        if (!conversation) {
            conversation = findConversationByExactParticipants(initialConversations, roomParticipants);
        }

        currentConversationId.current = conversation?._id ? conversation._id : "";

        socket?.emit('join room', { conversationId: currentConversationId.current });

        const sortedMessages = conversation?.messages?.sort((a: Message, b: Message) =>
            new Date(a.date!).getTime() - new Date(b.date!).getTime()
        ) || [];

        updateChatRef(sortedMessages);
        participants.current = roomParticipants;

        setMessageToSend(prev => ({
            ...prev,
            value: '',
            participantID: roomParticipants?.map(p => p._id!),
            conversationID: currentConversationId.current
        }));

        setMobileChatsSidebarOpen(false);
        setMobileUsersSidebarOpen(false);
    }, [socket, findConversationByExactParticipants, initialConversations, conversationsForBar, updateChatRef, setMobileChatsSidebarOpen, setMobileUsersSidebarOpen]);

    const handleLeaveRoom = useCallback(async () => {
        socket?.emit('leave room', { conversationId: currentConversationId.current });
        currentConversationId.current = "";
        updateChatRef([]);
        participants.current = null;
    }, [socket, updateChatRef]);

    return {
        chat,
        setChat: updateChatRef,
        chatRef,
        messageToSend,
        setMessageToSend,
        currentConversationId,
        participants,
        getLastMessages,
        handleLeaveRoom,
        handleTyping,
        isLocalTypingRef,

    };
};