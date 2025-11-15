"use client"
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import ChatUser from "@/types/chatUser";
import Message from "@/types/message";
import ConversationSummary from "./conversationSummary";
import { getConversations } from '@/app/lib/conversationActions'

interface ConversationsListProps {
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    newMessage: Message | undefined;
    participants: ChatUser[] | null;
    reloadKey: boolean;
    query: string;
}

const ConversationsList = ({ getLastMessages, newMessage, participants, reloadKey, query }: ConversationsListProps) => {
    const [conversations, setConversations] = useState<any>([]);
    const [loading, setLoading] = useState(true);
    const [fetchCode, setFetchCode] = useState(200);

    const router = useRouter();


    const fetchData = async () => {
        try {
            const fetchedConversations = await getConversations();
            setConversations(fetchedConversations.recentConversations);
        } catch (error: any) {
            setFetchCode(401);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [reloadKey]);

    useEffect(() => {
        if (fetchCode === 401) router.replace('/login');
    }, [fetchCode, router]);

    useEffect(() => {
        if (newMessage && newMessage?.conversationID) {
            setConversations((prevConversations: any[]) => {
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
                        members: participants,
                        messages: [newMessage],
                    };
                    updatedConversations.unshift(newConversation);
                }

                return updatedConversations;
            });
        }
    }, [newMessage]);

    return (
        <>
            {
                conversations?.length < 1 && loading ?
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">Loading...</p></div> :
                    conversations?.length < 1 && !loading &&
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">No recent conversations available.</p></div>
            }

            {
                conversations?.length > 0 && (
                    <div className="divide-y overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                        {conversations.map((conversation: any) => {
                            const membersEmailsIncludeQuery = conversation.members.some((m: any) => m.email?.toUpperCase().includes(query.toUpperCase()));
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
