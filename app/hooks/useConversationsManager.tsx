import { useCallback, useRef, useState } from 'react';
import Message from '@/types/message';
import Conversation from '@/types/conversation';
import { getConversationMembers } from '@/app/lib/chatActions';

interface UseConversationsManagerProps {
    initialConversations: Conversation[];
}

export const useConversationsManager = ({
    initialConversations,
}: UseConversationsManagerProps) => {
    const [conversationsForBar, setConversationsForBar] = useState<Conversation[]>(initialConversations);
    const pendingConversations = useRef<Set<string>>(new Set());

    const updateConversationsBar = useCallback(async (
        message: Message | null,
        mode: string = "",
        cleanId?: string
    ) => {
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

        setConversationsForBar(prevConversations => {
            const updatedConversations = [...prevConversations];
            const conversationIndex = updatedConversations.findIndex(
                conv => conv._id?.toUpperCase() === conversationId?.toUpperCase()
            );

            if (conversationIndex > -1) {
                // Existing conversation - update messages and move to top
                const [conversation] = updatedConversations.splice(conversationIndex, 1);
                if (!conversation.messages?.some(m => m._id === message._id)) {
                    conversation.messages = [...(conversation.messages || []), message];
                }
                updatedConversations.unshift(conversation);
                return updatedConversations;
            } else {
                // New conversation - fetch members before adding to UI
                // Check if we're already fetching this conversation
                if (pendingConversations.current.has(conversationId!)) {
                    return prevConversations; // Already fetching, don't duplicate
                }

                pendingConversations.current.add(conversationId!);

                // Fetch members asynchronously
                (async () => {
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

                            const result = await getConversationMembers(conversationId!);

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
                                    _id: conversationId!,
                                    members,
                                    messages: [message],
                                };
                                return [newConversation, ...prev];
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching conversation members:', error);
                    } finally {
                        pendingConversations.current.delete(conversationId!);
                    }
                })();

                // Don't modify conversations array yet - wait for async fetch
                return prevConversations;
            }
        });
    }, []);

    return {
        conversationsForBar,
        updateConversationsBar,
        setConversationsForBar
    };
};