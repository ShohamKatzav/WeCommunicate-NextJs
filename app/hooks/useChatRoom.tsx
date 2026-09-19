import { useCallback, useEffect, useRef, useState } from 'react';
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

// A conversation that doesn't exist yet (no id) is keyed by its sorted
// participant ids instead, so a draft started before the first message is
// sent still round-trips once the real conversation exists.
const getDraftKey = (roomParticipants: ChatUser[], conversationId: string) => {
    if (conversationId) return `wecommunicate_draft:${conversationId}`;
    const ids = roomParticipants.map(p => p._id).sort().join(',');
    return `wecommunicate_draft:new:${ids}`;
};

const readDraft = (key: string): string => {
    try {
        return localStorage.getItem(key) || '';
    } catch {
        // Private browsing / storage disabled - drafts just won't persist.
        return '';
    }
};

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
        if (currentConversationId.current) {
            socket?.emit('message read', { conversationId: currentConversationId.current });
        }

        const sortedMessages = conversation?.messages?.sort((a: Message, b: Message) =>
            new Date(a.date!).getTime() - new Date(b.date!).getTime()
        ) || [];

        updateChatRef(sortedMessages);
        participants.current = roomParticipants;

        // Restore whatever was drafted for this conversation - previously
        // this set a `value` field that doesn't exist on Message, so `text`
        // (and whatever the user had been typing) silently carried over
        // into whichever conversation was opened next instead of clearing.
        const draftText = readDraft(getDraftKey(roomParticipants, currentConversationId.current));

        setMessageToSend(prev => ({
            ...prev,
            text: draftText,
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

    // Persist the in-progress draft for whichever conversation is open right
    // now on every change - including it being cleared after a send, which
    // removes the stored draft too. Refs (participants/currentConversationId)
    // are read fresh each time this runs; messageToSend.text is what
    // actually drives re-runs.
    useEffect(() => {
        if (!participants.current) return;
        const key = getDraftKey(participants.current, currentConversationId.current);
        try {
            if (messageToSend.text?.trim()) {
                localStorage.setItem(key, messageToSend.text);
            } else {
                localStorage.removeItem(key);
            }
        } catch {
            // Private browsing / storage disabled - not fatal, just no drafts.
        }
    }, [messageToSend.text]);

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
