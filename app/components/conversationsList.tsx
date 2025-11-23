"use client"
import { useEffect, useState, RefObject } from "react";
import ChatUser from "@/types/chatUser";
import Message from "@/types/message";
import ConversationSummary from "./conversationSummary";
import Conversation from "@/types/conversation";
import { useReloadConversationBar } from "../hooks/useReloadConversationBar";

interface ConversationsListProps {
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    newMessage: Message | undefined;
    participants: RefObject<ChatUser[] | null>;
    query: string;
    initialConversations: Conversation[];
}

const ConversationsList =
    ({ getLastMessages,
        newMessage,
        participants,
        query,
        initialConversations }: ConversationsListProps) => {

        const { reloadKey } = useReloadConversationBar();
        const [conversations, setConversations] = useState<Conversation[]>(initialConversations || []);

        // Sync with server data when it changes
        useEffect(() => {
            setConversations(initialConversations || []);
        }, [initialConversations]);

        useEffect(() => {
            if (participants.current) {
                getLastMessages(participants.current);
            }
        }, [reloadKey]);

        useEffect(() => {
            if (!newMessage || !newMessage.conversationID) return;

            setConversations((prevConversations: any[]) => {
                // If top message already equals incoming message, skip update
                if (prevConversations?.[0]?.messages?.[0]?._id === newMessage._id) return prevConversations;

                const updatedConversations = [...prevConversations];

                const conversationIndex = updatedConversations.findIndex(
                    conversation => conversation._id?.toUpperCase() === newMessage.conversationID?.toUpperCase()
                );

                if (conversationIndex > -1) {
                    // Update the existing conversation
                    const [conversation] = updatedConversations.splice(conversationIndex, 1);
                    conversation.messages = [newMessage, ...conversation.messages];
                    updatedConversations.unshift(conversation);
                } else {
                    const newConversation = {
                        _id: newMessage.conversationID,
                        members: participants.current || [],
                        messages: [newMessage],
                    };
                    updatedConversations.unshift(newConversation);
                }

                return updatedConversations;
            });
        }, [newMessage]);

        return (
            <>
                {
                    conversations?.length < 1 &&
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 dark:text-gray-400 text-center">No recent conversations available.</p>
                    </div>
                }

                {
                    conversations?.length > 0 && (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                            {conversations.map((conversation: any) => {
                                const membersEmailsIncludeQuery = conversation.members?.some((m: any) => m.email?.toUpperCase().includes(query.toUpperCase()));
                                const messageIncludeQuery = conversation.messages[0]?.text?.toUpperCase().includes(query.toUpperCase());
                                const show = query.trim() === '' || (membersEmailsIncludeQuery || messageIncludeQuery);
                                if (!show) return null;

                                return (
                                    <ConversationSummary
                                        key={conversation._id}
                                        conversation={conversation}
                                        getLastMessages={getLastMessages}
                                    />
                                );
                            })}
                        </div>
                    )
                }
            </>
        );
    };

export default ConversationsList;