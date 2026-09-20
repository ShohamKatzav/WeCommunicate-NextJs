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
    // The id of the first message in the "unread tail" of the room being
    // opened - set once per room switch (see getLastMessages) so ChatWindow
    // can render a divider there and land the initial scroll on it, instead
    // of always landing on the very bottom.
    const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | undefined>(undefined);
    // conversationsForBar is a client-side cache: a message someone else
    // sent never gets its cached `status` flipped to 'read' locally just
    // because *this* client emitted 'message read' (that only updates the
    // server, plus this client's own sent-messages' checkmarks - see
    // useSocketEvents' read-receipts handler). Without tracking what's
    // already been surfaced once, reopening the same room later would keep
    // reading the same still-'sent' cached messages and show the divider
    // again every time, ratcheting back to whatever was ever unread.
    const surfacedUnreadMessageIds = useRef<Set<string>>(new Set());

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

        // The 'message read' emit below marks every trailing unread message
        // as read server-side in one batch (there's no per-message read
        // position - see handleMessageRead in socket/handlers.js), so "how
        // far back does the unread streak go from the end" has to be read
        // off the data as loaded, before that happens. Revoked messages are
        // skipped rather than treated as a boundary or as unread - their
        // status is permanently 'revoked' and never becomes 'read', so
        // treating them as a stop condition would make every conversation
        // that ever had a deletion look permanently unread from that point.
        // Also stop at the first message already in surfacedUnreadMessageIds
        // - its cached `status` will never locally flip to 'read' just
        // because this client read it (see the ref's own comment), so
        // without this a reopen would recount the same old messages forever.
        const unreadTailIds: string[] = [];
        for (let i = sortedMessages.length - 1; i >= 0; i--) {
            const msg = sortedMessages[i];
            if (msg.status === 'revoked') continue;
            if (msg.sender?.toUpperCase() === userEmail?.toUpperCase()) break;
            if (msg.status === 'read') break;
            if (!msg._id || surfacedUnreadMessageIds.current.has(msg._id)) break;
            unreadTailIds.push(msg._id);
        }
        unreadTailIds.forEach(id => surfacedUnreadMessageIds.current.add(id));
        setFirstUnreadMessageId(unreadTailIds.at(-1));

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
            conversationID: currentConversationId.current,
            // A reply preview references a message in the conversation being
            // left - carrying it into the newly opened room would either
            // silently get dropped server-side (the referenced message won't
            // belong to this conversation) or, worse, land on the wrong one.
            replyTo: undefined
        }));

        setMobileChatsSidebarOpen(false);
        setMobileUsersSidebarOpen(false);
    }, [socket, userEmail, findConversationByExactParticipants, initialConversations, conversationsForBar, updateChatRef, setMobileChatsSidebarOpen, setMobileUsersSidebarOpen]);

    const handleLeaveRoom = useCallback(async () => {
        socket?.emit('leave room', { conversationId: currentConversationId.current });
        currentConversationId.current = "";
        updateChatRef([]);
        participants.current = null;
        setFirstUnreadMessageId(undefined);
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
        firstUnreadMessageId,

    };
};
