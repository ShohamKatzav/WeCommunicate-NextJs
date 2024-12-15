import { useEffect, useState } from "react";
import fetchRecentConversations from "../actions/conversation-actions";
import chatUser from "../types/chatUser";
import { useUser } from "../hooks/useUser";
import AsName from "../utils/asName";
import ChatUser from "../types/chatUser";
import Message from "../types/message";
import { useNotification } from "../hooks/useNotification";

interface ConversationsPanelProps {
    getLastMessages: (participantFromList: ChatUser) => Promise<void>;
    newMessage: Message | undefined;
    participant: ChatUser | undefined;
}

const RecentConversationsPanel = ({ getLastMessages, newMessage, participant }: ConversationsPanelProps) => {
    const [conversations, setConversations] = useState<any>([]);
    const { user } = useUser();
    const { initializeRoomNotifications } = useNotification();

    useEffect(() => {
        const fetchData = async () => {
            const fetchedConversations = await fetchRecentConversations();
            setConversations(fetchedConversations.recentConversations);
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (newMessage && newMessage?.conversationID) {
            setConversations((prevConversations: any[]) => {
                const updatedConversations = [...prevConversations];

                const conversationIndex = updatedConversations.findIndex(
                    conversation => conversation._id.toUpperCase() === newMessage.conversationID?.toUpperCase()
                );

                if (conversationIndex > -1) {
                    // Update the existing conversation
                    const [conversation] = updatedConversations.splice(conversationIndex, 1);
                    conversation.messages = [newMessage, ...conversation.messages];
                    updatedConversations.unshift(conversation);
                } else {
                    const isCurrentUserSender = newMessage.sender?.toUpperCase() === user?.email?.toUpperCase();
                    const newConversation = {
                        _id: newMessage.conversationID,
                        members: isCurrentUserSender
                        ? [
                              { email: user?.email },
                              { email: participant?.email },
                          ]
                        : [
                              { email: user?.email },
                              { email: newMessage?.sender },
                          ],
                        messages: [newMessage],
                    };
                    updatedConversations.unshift(newConversation);
                }

                return updatedConversations;
            });
        }
    }, [newMessage, newMessage?.conversationID]);

    const switchRoom = (otherMember: chatUser) => {
        initializeRoomNotifications(otherMember?.email!);
        getLastMessages(otherMember);
    }

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg shadow-md max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-700 mb-6">Recent Conversations</h2>
            {conversations && conversations.length > 0 ? (
                <ul className="space-y-5">
                    {conversations.map((conversation: any, conversationIndex: number) => {
                        const otherMember = conversation.members.find(
                            (member: chatUser) =>
                                member.email?.toUpperCase() !== user?.email?.toUpperCase()
                        );

                        return (
                            <li
                                key={conversationIndex}
                                className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow"
                                onClick={() => switchRoom(otherMember)}
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
                                    {otherMember?.email?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="flex-1">
                                    <div className="text-gray-800 font-medium text-lg">
                                        {AsName(otherMember?.email).split("@")[0] || "Unknown User"}
                                    </div>
                                    {conversation.messages && conversation.messages.length > 0 ? (
                                        <div className="text-gray-600 text-sm">
                                            <span className="font-semibold text-gray-800">
                                                {conversation.messages[0].sender.toUpperCase() === user?.email?.toUpperCase() ? 'You' :
                                                    conversation.messages[0].sender.split("@")[0]}
                                            </span>
                                            : {conversation.messages[0].value}
                                            <div className="text-xs text-gray-400">
                                                {conversation.messages[0].date &&
                                                    new Date(conversation.messages[0].date).toLocaleString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-gray-500 text-sm italic">
                                            No messages yet.
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-gray-600 text-center">No recent conversations available.</p>
            )}
        </div>
    );
};

export default RecentConversationsPanel;