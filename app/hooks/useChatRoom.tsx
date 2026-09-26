import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import Message from '@/types/message';
import ChatUser from '@/types/chatUser';
import Conversation from '@/types/conversation';
import { PendingClears } from './usePendingCleanHistory';
import { findConversationId, getOrCreateConversationId } from '../lib/conversationActions';
import { TYPING_IDLE_MS, TYPING_REFRESH_MS } from '../config/limits';
import { registerOpenRoom } from '../utils/chatReturn';
import { isPendingConversationId } from './useConversationsManager';

interface UseChatRoomProps {
    socket: Socket | null;
    userEmail?: string;
    initialConversations: Conversation[];
    conversationsForBar: Conversation[];
    setMobileChatsSidebarOpen: (value: boolean) => void;
    setMobileUsersSidebarOpen: (value: boolean) => void;
    pendingClearsRef: React.RefObject<PendingClears>;
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
    setMobileUsersSidebarOpen,
    pendingClearsRef
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
    // The conversation 'start typing' was sent for - 'stop typing' goes to
    // this one, not whichever conversation happens to be open when the idle
    // timer fires (switching rooms mid-sentence used to send it to the new
    // room and leave the old one stuck on "typing...").
    const typingConversationRef = useRef<string>("");
    const lastTypingSentAtRef = useRef<number>(0);

    const stopLocalTyping = useCallback(() => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        if (isLocalTypingRef.current && typingConversationRef.current) {
            socket?.emit('stop typing', { conversationId: typingConversationRef.current });
        }
        isLocalTypingRef.current = false;
        typingConversationRef.current = "";
    }, [socket]);

    // Closing or reloading the tab mid-sentence sends the stop itself. The
    // server also sends one when the socket disconnects, but behind Render's
    // proxy a closed tab's WebSocket isn't reported as disconnected for a
    // while, so without this the other side kept "typing..." until their
    // own expiry (TYPING_EXPIRE_MS). A frame sent here still goes out
    // before the connection is torn down.
    useEffect(() => {
        window.addEventListener('pagehide', stopLocalTyping);
        return () => window.removeEventListener('pagehide', stopLocalTyping);
    }, [stopLocalTyping]);

    const handleTyping = useCallback(() => {
        const conversationId = currentConversationId.current;
        if (!conversationId || !socket) return;

        // Sent on the first keystroke, then again every TYPING_REFRESH_MS
        // while typing continues - receivers expire an indicator that stops
        // being refreshed (useSocketEvents.tsx), which is what clears it when
        // this tab vanishes without ever sending a stop.
        const now = Date.now();
        if (
            !isLocalTypingRef.current
            || typingConversationRef.current !== conversationId
            || now - lastTypingSentAtRef.current >= TYPING_REFRESH_MS
        ) {
            isLocalTypingRef.current = true;
            typingConversationRef.current = conversationId;
            lastTypingSentAtRef.current = now;
            socket.emit('start typing', { conversationId });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(stopLocalTyping, TYPING_IDLE_MS);
    }, [socket, stopLocalTyping]);

    const updateChatRef = useCallback((newChat: Message[]) => {
        chatRef.current = newChat;
        setChat(newChat);
    }, []);

    const findConversationByExactParticipants = useCallback(
        (conversations: Conversation[], roomParticipants: ChatUser[]) => {
            const targetIds = roomParticipants.map(p => p._id).sort();

            return conversations.find(conv => {
                // A row for a chat the server hasn't created yet has no real
                // id to open or join (see showSentMessage).
                if (isPendingConversationId(conv._id)) return false;
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

    // Bumped on every open and leave, so an async lookup that finishes after
    // the user has moved on to another chat can tell, and drop its result.
    const openSequenceRef = useRef(0);

    // Gives the open, id-less chat its real conversation id: joins the room
    // (typing, live messages and read receipts all travel through it) and
    // moves any draft from the id-less key to the conversation's own key.
    const adoptConversationId = useCallback((conversationId: string) => {
        currentConversationId.current = conversationId;
        socket?.emit('join room', { conversationId });

        let draft = '';
        if (participants.current) {
            const pendingKey = getDraftKey(participants.current, '');
            const savedKey = getDraftKey(participants.current, conversationId);
            const pending = readDraft(pendingKey);
            draft = pending || readDraft(savedKey);
            if (pending) {
                try {
                    localStorage.setItem(savedKey, pending);
                    localStorage.removeItem(pendingKey);
                } catch {
                    // Private browsing / storage disabled - not fatal, just no drafts.
                }
            }
        }

        // The state update is also what flows the new id into everything
        // reading currentConversationId.current via a prop - it's a ref, so
        // nothing re-renders on its own.
        setMessageToSend(prev => ({ ...prev, conversationID: conversationId, text: prev.text || draft }));
    }, [socket]);

    const getLastMessages = useCallback(async (roomParticipants: ChatUser[]) => {
        if (!roomParticipants) return;
        const openSequence = ++openSequenceRef.current;

        if (currentConversationId.current) {
            stopLocalTyping();
            socket?.emit('leave room', { conversationId: currentConversationId.current });
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

        // A pending clear this device applied offline but hasn't synced yet
        // (see usePendingCleanHistory) - the bar/initial-conversations
        // source above may still carry messages at or before that cutoff
        // (e.g. right after a reload, before useConversationsManager's own
        // mount filter has run), so this is filtered again here regardless.
        const cutoff = currentConversationId.current
            ? pendingClearsRef.current[currentConversationId.current]
            : undefined;
        const cutoffTime = cutoff ? new Date(cutoff).getTime() : undefined;

        const sortedMessages = (conversation?.messages || [])
            .filter((m: Message) => cutoffTime === undefined || new Date(m.date!).getTime() > cutoffTime)
            .sort((a: Message, b: Message) =>
                new Date(a.date!).getTime() - new Date(b.date!).getTime()
            );

        // The 'message read' emit below marks every trailing unread message
        // as read server-side in one batch (there's no per-message read
        // position - see handleMessageRead in socket/handlers.ts), so "how
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

        // Not in this device's list doesn't mean it doesn't exist - a
        // conversation this user deleted is hidden from their list but is
        // still the same conversation, and the other person may be typing or
        // sending in it right now. There's nothing visible to load (deleting
        // it set a history cutoff, and any newer message would have put it
        // back in the list), so only the id and the room are missing.
        // Deliberately not awaited: callers wait for getLastMessages before
        // closing UI (the "Select a friend" modal closes only after it
        // returns), so a slow or failed request here must never hold that
        // up. Offline it skips the request entirely - the service worker
        // answers an unrecognised server action with a 503, which throws.
        // Either way the chat still works id-less, as it did before this
        // lookup existed, and the first message sent finds the conversation.
        if (!currentConversationId.current && roomParticipants.length > 0 && navigator.onLine) {
            findConversationId(roomParticipants.map(p => p._id!))
                .then(result => {
                    // Another chat was opened (or this one left) while the
                    // lookup was in flight, or a first message already
                    // supplied the id.
                    if (openSequence !== openSequenceRef.current || currentConversationId.current) return;
                    if (result.success && result.conversationId) adoptConversationId(result.conversationId);
                })
                .catch(() => {
                    // Went offline mid-request, or the server failed - see above.
                });
        }
    }, [socket, userEmail, findConversationByExactParticipants, initialConversations, conversationsForBar, updateChatRef, setMobileChatsSidebarOpen, setMobileUsersSidebarOpen, pendingClearsRef, stopLocalTyping, adoptConversationId]);

    // Some features (calls, disappearing messages) need a real conversation
    // id to scope themselves to, but a brand-new chat has none yet - no
    // Conversation document exists until the first message is sent (see
    // ConversationRepository.GetOrCreateConversationByMembers, used the same
    // way by MessageRepository.SaveMessage). This creates that document on
    // demand, the same lazy creation the first message send already does,
    // so those features work before any message has ever been sent.
    const ensureConversationId = useCallback(async (): Promise<string> => {
        if (currentConversationId.current) return currentConversationId.current;
        if (!participants.current?.length) return "";

        const openSequence = openSequenceRef.current;
        let result;
        try {
            result = await getOrCreateConversationId(participants.current.map(p => p._id!));
        } catch {
            // Offline: the service worker answers this server action with a
            // 503 (it isn't a queueable shape), which throws. "" is the
            // failure value callers already handle (a toast, the button
            // re-enabled) - a thrown error would leave them stuck.
            return "";
        }
        if (!result.success || !result.conversationId) return "";
        // The id belongs to the chat this was asked for - if another one has
        // been opened since, it must not be applied to that one.
        if (openSequence !== openSequenceRef.current) return "";

        // The open-time lookup may have found it first; it's the same
        // conversation either way.
        if (!currentConversationId.current) adoptConversationId(result.conversationId);
        return currentConversationId.current;
    }, [adoptConversationId]);

    const handleLeaveRoom = useCallback(async () => {
        openSequenceRef.current++;
        stopLocalTyping();
        socket?.emit('leave room', { conversationId: currentConversationId.current });
        currentConversationId.current = "";
        updateChatRef([]);
        participants.current = null;
        setFirstUnreadMessageId(undefined);
    }, [socket, updateChatRef, stopLocalTyping]);

    // Lets a profile link snapshot the open room (see utils/chatReturn.ts).
    useEffect(() => registerOpenRoom(() => participants.current
        ? { conversationId: currentConversationId.current, participants: participants.current }
        : null), []);

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
        ensureConversationId,
        handleLeaveRoom,
        handleTyping,
        isLocalTypingRef,
        firstUnreadMessageId,

    };
};
