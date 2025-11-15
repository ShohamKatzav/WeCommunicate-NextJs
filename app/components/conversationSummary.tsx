import { useEffect, useState } from "react";
import { useNotification } from "../hooks/useNotification";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import ChatUser from "@/types/chatUser";
import Conversation from "@/types/conversation";
import Message from "@/types/message";
import { AsShortName } from "../utils/asName";

interface ConversationConversationSummaryProps {

    conversation: Conversation;
    getLastMessages: (participantsFromList: ChatUser[]) => Promise<void>;
}

const ConversationSummary = ({ conversation, getLastMessages }: ConversationConversationSummaryProps) => {

    const [otherMembers, setOtherMembers] = useState<ChatUser[]>();
    const [lastMessage, setLastMessage] = useState<Message | undefined>(
        conversation.messages?.[0]
    );

    const { user } = useUser();
    const { socket, loadingSocket } = useSocket();
    const { initializeRoomNotifications, newMessageNotification } = useNotification();

    const incoming = newMessageNotification[conversation._id!];

    const switchRoom = (otherMembers: ChatUser[]) => {
        initializeRoomNotifications(conversation._id!);
        getLastMessages(otherMembers);
    }

    useEffect(() => {
        const temp = conversation.members.filter(
            (member: ChatUser) =>
                member.email?.toUpperCase() !== user?.email?.toUpperCase()
        );
        setOtherMembers(temp);
    }, [conversation.members]);

    useEffect(() => {
        setLastMessage(conversation.messages?.[0]);
    }, [conversation.messages]);

    useEffect(() => {
        if (!socket || loadingSocket) return;

        const handleDeletedMessage = (deletedMessage: Message) => {
            // Only update if this conversation contains the deleted message
            if (lastMessage?._id === deletedMessage._id) {
                setLastMessage(prev =>
                    prev ? { ...prev, text: undefined, status: "revoked" } : prev
                );
            }
        };

        socket.on("delete message", handleDeletedMessage);

        return () => {
            socket.off("delete message", handleDeletedMessage);
        };
    }, [socket, loadingSocket, lastMessage?._id]);

    return (
        otherMembers && <li
            className="bg-white p-3 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow"
            onClick={() => switchRoom(otherMembers)}
        >
            <div className="w-full text-left p-2 flex gap-3 items-center hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="w-12 h-12 rounded-full bg-linear-to-r from-amber-400 to-red-500 flex items-center justify-center">
                    {otherMembers.length > 0 ? (
                        otherMembers.map((member, index) => {
                            const letter = (member.email || "U")[0].toUpperCase();
                            const isLast = index === otherMembers.length - 1;

                            return (
                                index < 3 &&
                                <span key={index} className="text-white font-bold">
                                    {letter}
                                    {!isLast && ","}
                                </span>
                            );
                        })
                    ) : (
                        <span className="text-white text-xs">No members in this conversation.</span>
                    )}
                </div>


                <div className="flex-1">
                    <div className="grid grid-cols-8 justify-between items-center">
                        <div className="col-span-7">
                            {(otherMembers.map((member, index) => (
                                index < otherMembers.length - 1 ?
                                    <span key={index} className="font-medium">{AsShortName(member.email)}, </span> :
                                    <span key={index} className="font-medium">{AsShortName(member.email)}</span>
                            )))
                            }
                        </div>
                        <div className="col-span-1 justify-self-end">
                            {incoming > 0 && (
                                <div className="w-5 h-5 flex items-center justify-center text-white bg-red-600 rounded-full">
                                    {incoming}
                                </div>
                            )}
                        </div>
                    </div>
                    {lastMessage ?
                        <div className="grid grid-cols-2 justify-between items-center text-gray-400">
                            <div>{AsShortName(lastMessage.sender)}</div>

                            <div className="items-center gap-2 justify-self-end">
                                {new Date(lastMessage.date!).toLocaleTimeString([], {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                })}

                            </div>
                            <div className="text-sm text-gray-500 break-all col-span-2">{lastMessage.status?.includes("revoked")
                                ? "Message deleted"
                                : (lastMessage.text || "sent file " + lastMessage.file?.pathname)}
                            </div>
                        </div>
                        :
                        <div className="text-gray-500 text-sm italic">
                            No messages yet.
                        </div>
                    }

                </div>
            </div>
        </li >
    );
};

export default ConversationSummary;