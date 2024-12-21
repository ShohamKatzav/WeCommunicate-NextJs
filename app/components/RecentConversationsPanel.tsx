import { useEffect, useRef, useState } from "react";
import fetchRecentConversations from "../actions/conversation-actions";
import chatUser from "../types/chatUser";
import { useUser } from "../hooks/useUser";
import AsName from "../utils/asName";
import ChatUser from "../types/chatUser";
import Message from "../types/message";
import { useNotification } from "../hooks/useNotification";
import useIsMedium from "../hooks/useIsMedium";

interface ConversationsPanelProps {
    getLastMessages: (participantFromList: ChatUser) => Promise<void>;
    newMessage: Message | undefined;
    participant: ChatUser | undefined;
}

const RecentConversationsPanel = ({ getLastMessages, newMessage, participant }: ConversationsPanelProps) => {
    const [conversations, setConversations] = useState<any>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useUser();
    const { initializeRoomNotifications, newMessageNotification } = useNotification();
    const isMediumScreen = useIsMedium();

    const [toggle, setToggle] = useState(isMediumScreen);
    const dropRef = useRef<HTMLUListElement>(null);
    const openRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLDivElement>(null);

    const dropupHandler = () => {
        if (!toggle) {
            dropRef.current?.classList.add("hidden");
            openRef.current?.classList.add("hidden");
            closeRef.current?.classList.remove("hidden");
        } else {
            dropRef.current?.classList.remove("hidden");
            closeRef.current?.classList.add("hidden");
            openRef.current?.classList.remove("hidden");
        }
        setToggle(!toggle);
    };

    useEffect(() => {
        const fetchData = async () => {
            const fetchedConversations = await fetchRecentConversations();
            setConversations(fetchedConversations.recentConversations);
            setLoading(false);
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
                                { _id: participant?._id, email: participant?.email },
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
        if (!isMediumScreen)
            setToggle(!toggle);
    }

    return (
        <>
            <button type="button" className="min-w-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:bg-gray-100 p-4 shadow rounded
        bg-white text-sm font-medium leading-none text-gray-800 flex items-center justify-between md:my-3.5 my-2" onClick={dropupHandler}>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center flex-1">
                    Recent Conversations
                </h2>
                <div>
                    <div className="hidden" ref={closeRef}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.00016 0.666664L9.66683 5.33333L0.333496 5.33333L5.00016 0.666664Z" fill="#1F2937" />
                        </svg>
                    </div>
                    <div ref={openRef}>
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.00016 5.33333L0.333496 0.666664H9.66683L5.00016 5.33333Z" fill="#1F2937" />
                        </svg>
                    </div>
                </div>
            </button>
            {
                conversations.length < 1 && loading ?
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">Loading...</p></div> :
                    conversations.length < 1 && !loading &&
                    <div className="bg-white p-4 rounded-lg shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow">
                        <p className="text-gray-600 text-center">No recent conversations available.</p></div>
            }

            {toggle && conversations.length > 0 && (
                <ul className="md:space-y-5 space-y-2">
                    {conversations.map((conversation: any, conversationIndex: number) => {
                        const otherMember = conversation.members.find(
                            (member: chatUser) =>
                                member.email?.toUpperCase() !== user?.email?.toUpperCase()
                        );
                        const incoming = newMessageNotification[otherMember.email?.toUpperCase()!];

                        return (
                            otherMember && <li
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
                                        <div className="text-gray-600 text-sm relative">
                                            <span className="font-semibold text-gray-800">
                                                {conversation.messages[0].sender.toUpperCase() === user?.email?.toUpperCase() ? 'You' :
                                                    conversation.messages[0].sender.split("@")[0]}
                                            </span>
                                            : {conversation.messages[0].value}
                                            <div className="text-xs text-gray-400">
                                                {conversation.messages[0].date &&
                                                    new Date(conversation.messages[0].date).toLocaleString()}
                                            </div>
                                            {incoming > 0 &&
                                                <span className="inline-flex items-center justify-center px-2 py-1
                                                text-xl font-bold leading-none text-white 
                                                bg-red-600 rounded-full absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
                                                    {incoming}
                                                </span>
                                            }
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
            )
            }
        </>
    );
};

export default RecentConversationsPanel;