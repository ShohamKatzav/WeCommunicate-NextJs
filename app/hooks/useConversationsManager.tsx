import { useCallback, useEffect, useRef, useState } from 'react';
import Message from '@/types/message';
import Conversation from '@/types/conversation';
import ChatUser from '@/types/chatUser';
import { getConversationMembers } from '@/app/lib/chatActions';
import { PendingClears } from './usePendingCleanHistory';

// The id of a sidebar row shown for a brand-new conversation before the
// server has created it (see showSentMessage). Never a real conversation id,
// so nothing may join a room or look one up by it - see useChatRoom.
export const PENDING_CONVERSATION_PREFIX = 'pending:';
export const isPendingConversationId = (id?: string) => !!id?.startsWith(PENDING_CONVERSATION_PREFIX);

interface UseConversationsManagerProps {
    initialConversations: Conversation[];
    pendingClears: PendingClears;
    pendingClearsRef: React.RefObject<PendingClears>;
}

export const useConversationsManager = ({
    initialConversations,
    pendingClears,
    pendingClearsRef,
}: UseConversationsManagerProps) => {
    const [conversationsForBar, setConversationsForBar] = useState<Conversation[]>(initialConversations);
    const pendingConversations = useRef<Set<string>>(new Set());
    // Mirrors which conversation ids we currently know about, so
    // updateConversationsBar can branch on membership synchronously without
    // depending on conversationsForBar directly (which would make this
    // callback's identity change on every update).
    const knownConversationIds = useRef<Set<string>>(
        new Set(initialConversations.map(c => c._id).filter((id): id is string => Boolean(id)))
    );

    useEffect(() => {
        knownConversationIds.current = new Set(
            conversationsForBar.map(c => c._id).filter((id): id is string => Boolean(id))
        );
    }, [conversationsForBar]);

    // Seeds the bar from a locally-pending clear that hasn't synced yet -
    // covers a reload before the offline queue flushes, where the server
    // still returned the pre-clear messages in initialConversations. Runs
    // once pendingClears is actually populated (it starts as {} until
    // usePendingCleanHistory's own mount effect reads localStorage), and is
    // a no-op once there's nothing left to hide.
    useEffect(() => {
        if (Object.keys(pendingClears).length === 0) return;
        setConversationsForBar(prev => {
            let changed = false;
            const next = prev.map(conv => {
                const cutoff = conv._id ? pendingClears[conv._id] : undefined;
                if (!cutoff) return conv;
                const cutoffTime = new Date(cutoff).getTime();
                const filteredMessages = (conv.messages || []).filter(
                    m => new Date(m.date!).getTime() > cutoffTime
                );
                if (filteredMessages.length === (conv.messages?.length || 0)) return conv;
                changed = true;
                return { ...conv, messages: filteredMessages };
            });
            return changed ? next : prev;
        });
    }, [pendingClears]);

    // Side effects (the pending-fetch ref mutation and the async request)
    // live in a plain function, not inside a setState updater - updater
    // functions must be pure, and React can invoke them more than once for
    // the same update (e.g. under StrictMode), which would otherwise fire
    // duplicate fetches for the same new conversation.
    const fetchAndAddConversation = useCallback(async (conversationId: string, message: Message) => {
        try {
            let members = [];
            let attempts = 0;
            const maxAttempts = 3;

            // Retry logic for handling timing issues with new conversations
            // (especially important for group chats where server might still be processing)
            while (attempts < maxAttempts) {
                attempts++;

                // Small delay before first attempt (and longer delays for retries)
                await new Promise(resolve => setTimeout(resolve, attempts * 100));

                const result = await getConversationMembers(conversationId);

                if (result.success && result.members?.length > 0) {
                    members = result.members;
                    break; // Success! Exit retry loop
                }

                // If last attempt failed, give up
                if (attempts === maxAttempts) {
                    console.warn(`Failed to fetch members for conversation ${conversationId} after ${maxAttempts} attempts`);
                }
            }

            // Only add conversation if we successfully got members
            // This prevents broken UI with missing participant names
            if (members.length > 0) {
                setConversationsForBar(prev => {
                    // Double-check it wasn't added by another update
                    const exists = prev.some(c => c._id === conversationId);
                    if (exists) {
                        // Just update members if it exists
                        return prev.map(conv =>
                            conv._id === conversationId
                                ? { ...conv, members }
                                : conv
                        );
                    }

                    // Add new conversation with complete data
                    const newConversation: Conversation = {
                        _id: conversationId,
                        members,
                        messages: [message],
                    };
                    return [newConversation, ...prev];
                });
            }
        } catch (error) {
            console.error('Error fetching conversation members:', error);
        } finally {
            pendingConversations.current.delete(conversationId);
        }
    }, []);

    const updateConversationsBar = useCallback(async (
        message: Message | null,
        mode: string = "",
        cleanId?: string,
        // The other members of a conversation this client just created
        // (see useMessageHandling's handleServerSavedMessageResponse) - lets
        // its row appear immediately instead of only after the members
        // lookup below, which never happens if the connection drops first.
        knownMembers?: ChatUser[],
        // The temp id of the message this one is the server's copy of (see
        // showSentMessage): the optimistic entry - and a pending row's
        // placeholder id - become the real ones, instead of the row showing
        // the message twice or appearing twice.
        replacesTempId?: string
    ) => {
        if (replacesTempId && message?.conversationID) {
            const conversationId = message.conversationID;
            const pendingId = PENDING_CONVERSATION_PREFIX + replacesTempId;
            const swap = (messages: Message[] = []) => {
                const replaced = messages.map(m => m._id === replacesTempId ? message : m);
                return replaced.filter((m, i) => replaced.findIndex(x => x._id === m._id) === i);
            };
            setConversationsForBar(prev => {
                const pendingRow = prev.find(c => c._id === pendingId);
                if (pendingRow) {
                    const existing = prev.find(c => c._id === conversationId);
                    if (existing) {
                        // The conversation was already there (hidden, or opened
                        // another way) - fold the optimistic row into it.
                        return prev
                            .filter(c => c._id !== pendingId)
                            .map(c => c._id === conversationId
                                ? { ...c, messages: swap([...(c.messages || []), ...(pendingRow.messages || [])]) }
                                : c);
                    }
                    return prev.map(c => c._id === pendingId ? { ...c, _id: conversationId, messages: swap(c.messages) } : c);
                }
                if (!prev.some(c => c.messages?.some(m => m._id === replacesTempId))) return prev;
                return prev.map(c => c.messages?.some(m => m._id === replacesTempId) ? { ...c, messages: swap(c.messages) } : c);
            });
        }

        if (mode === "Clean" && cleanId) {
            setConversationsForBar(prev => {
                let updated = [...prev];
                const idx = updated.findIndex(
                    c => c._id?.toUpperCase() === cleanId.toUpperCase()
                );
                if (idx !== -1) {
                    const conv = { ...updated[idx], messages: [] };
                    updated.splice(idx, 1);
                    updated.unshift(conv);
                }
                return updated;
            });
            return;
        }

        if (mode === "Delete" && cleanId) {
            setConversationsForBar(prev => {
                if (!cleanId) return prev;
                return prev.filter(
                    c => c._id?.toUpperCase() !== cleanId.toUpperCase()
                );
            });
            return;
        }

        if (!message) return;
        const conversationId = message.conversationID;
        if (!conversationId) return;

        if (knownConversationIds.current.has(conversationId)) {
            // Existing conversation - update messages and move to top. This
            // is a pure computation, safe inside the updater.
            setConversationsForBar(prevConversations => {
                // A message that predates this device's own pending clear
                // (not yet synced) must not resurrect the conversation's
                // preview or bump it back to the top of the bar.
                const cutoff = pendingClearsRef.current[conversationId];
                if (cutoff && new Date(message.date!).getTime() <= new Date(cutoff).getTime()) {
                    return prevConversations;
                }

                const updatedConversations = [...prevConversations];
                const conversationIndex = updatedConversations.findIndex(
                    conv => conv._id?.toUpperCase() === conversationId.toUpperCase()
                );
                if (conversationIndex === -1) return prevConversations;

                const [conversation] = updatedConversations.splice(conversationIndex, 1);
                if (!conversation.messages?.some(m => m._id === message._id)) {
                    conversation.messages = [...(conversation.messages || []), message];
                }
                updatedConversations.unshift(conversation);
                return updatedConversations;
            });
            return;
        }

        // New conversation this client created - show it now with the
        // members it already knows; the lookup below still refreshes them
        // (full profiles, this user's own entry) once it succeeds.
        if (knownMembers?.length) {
            setConversationsForBar(prev => prev.some(c => c._id === conversationId)
                ? prev
                : [{ _id: conversationId, members: knownMembers, messages: [message] }, ...prev]);
        }

        // New conversation - fetch members before adding to UI.
        if (pendingConversations.current.has(conversationId)) {
            return; // Already fetching, don't duplicate
        }
        pendingConversations.current.add(conversationId);
        void fetchAndAddConversation(conversationId, message);
    }, [fetchAndAddConversation, pendingClearsRef]);

    // Optimistic: a message this user just sent shows in the bar at once -
    // its chat moves to the top with the new preview - instead of after the
    // server has saved it (moderation plus the database write), and for a
    // brand-new chat also after a members lookup. A chat the bar doesn't have
    // yet gets a row under a pending id, from the members the open chat
    // already knows. updateConversationsBar(saved, ..., tempId) swaps in the
    // real message and id; dropSentMessage takes it back if the send failed.
    const showSentMessage = useCallback((message: Message, conversationId: string, otherMembers: ChatUser[]) => {
        if (!message._id) return;
        if (conversationId && knownConversationIds.current.has(conversationId)) {
            void updateConversationsBar({ ...message, conversationID: conversationId });
            return;
        }
        if (otherMembers.length === 0) return;
        const pendingId = PENDING_CONVERSATION_PREFIX + message._id;
        setConversationsForBar(prev => [
            { _id: pendingId, members: otherMembers, messages: [{ ...message, conversationID: pendingId }] },
            ...prev.filter(c => c._id !== pendingId),
        ]);
    }, [updateConversationsBar]);

    const dropSentMessage = useCallback((tempId: string) => {
        const pendingId = PENDING_CONVERSATION_PREFIX + tempId;
        setConversationsForBar(prev => {
            if (!prev.some(c => c._id === pendingId || c.messages?.some(m => m._id === tempId))) return prev;
            return prev
                .filter(c => c._id !== pendingId)
                .map(c => c.messages?.some(m => m._id === tempId)
                    ? { ...c, messages: (c.messages ?? []).filter(m => m._id !== tempId) }
                    : c);
        });
    }, []);

    return {
        conversationsForBar,
        updateConversationsBar,
        setConversationsForBar,
        showSentMessage,
        dropSentMessage
    };
};
