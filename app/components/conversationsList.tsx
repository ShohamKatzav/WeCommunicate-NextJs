"use client"
import ChatUser from "@/types/chatUser";
import ConversationSummary from "./conversationSummary";
import Conversation from "@/types/conversation";

interface ConversationsListProps {
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    query: string;
    initialConversations: Conversation[];
}

const ConversationsList =
    ({ getLastMessages,
        query,
        initialConversations }: ConversationsListProps) => {

        return (
            <>
                {
                    initialConversations?.length < 1 &&
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 dark:text-gray-400 text-center">No recent conversations available.</p>
                    </div>
                }

                {
                    initialConversations?.length > 0 && (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
                            {initialConversations.map((conversation: any) => {
                                const membersEmailsIncludeQuery = conversation.members?.some((m: any) => m.email?.toUpperCase().includes(query.toUpperCase()) || m.nickname?.toUpperCase().includes(query.toUpperCase()));
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
