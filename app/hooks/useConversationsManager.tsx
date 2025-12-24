import { useCallback, useState } from 'react';
import Message from '@/types/message';
import Conversation from '@/types/conversation';
import { getConversationMembers } from '@/app/lib/chatActions';

interface UseConversationsManagerProps {
    initialConversations: Conversation[];
    currentConversationId?: React.RefObject<string>;
}

export const useConversationsManager = ({
    initialConversations,
    currentConversationId
}: UseConversationsManagerProps) => {
    const [conversationsForBar, setConversationsForBar] = useState<Conversation[]>(initialConversations);

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

        if (mode === "Delete") {
            setConversationsForBar(prev => {
                if (!currentConversationId?.current) return prev;
                return prev.filter(
                    c => c._id?.toUpperCase() !== currentConversationId.current.toUpperCase()
                );
            });
            return;
        }

        if (!message) return;

        setConversationsForBar(prevConversations => {
            const updatedConversations = [...prevConversations];
            const conversationIndex = updatedConversations.findIndex(
                conv => conv._id?.toUpperCase() === message.conversationID?.toUpperCase()
            );

            if (conversationIndex > -1) {
                const [conversation] = updatedConversations.splice(conversationIndex, 1);
                if (!conversation.messages?.some(m => m._id === message._id)) {
                    conversation.messages = [...(conversation.messages || []), message];
                }
                updatedConversations.unshift(conversation);
            } else {
                const newConversation: Conversation = {
                    _id: message.conversationID!,
                    members: [],
                    messages: [message],
                };
                updatedConversations.unshift(newConversation);

                queueMicrotask(async () => {
                    const result = await getConversationMembers(message.conversationID!);
                    if (result.success) {
                        setConversationsForBar(prev =>
                            prev.map(conv =>
                                conv._id === message.conversationID
                                    ? { ...conv, members: result.members }
                                    : conv
                            )
                        );
                    }
                });
            }
            return updatedConversations;
        });
    }, [currentConversationId]);

    return {
        conversationsForBar,
        updateConversationsBar,
        setConversationsForBar
    };
};