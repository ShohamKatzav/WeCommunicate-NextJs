import { useEffect, useState } from "react";
import { useNotification } from "../../hooks/useNotification";
import { useUser } from "../../hooks/useUser";
import { useSocket } from "../../hooks/useSocket";
import ChatUser from "@/types/chatUser";
import Conversation from "@/types/conversation";
import Message from "@/types/message";
import MessageSearchResult from "@/types/messageSearchResult";
import { AsShortName } from "../../utils/stringFormat";
import { callRecordSummary } from "../../utils/callRecord";
import Avatar from "../ui/avatar";

interface ConversationConversationSummaryProps {
    conversation: Conversation;
    getLastMessages: (participantsFromList: ChatUser[]) => Promise<void>;
    searchMatch?: MessageSearchResult;
}

const ConversationSummary = ({ conversation, getLastMessages, searchMatch }: ConversationConversationSummaryProps) => {

    const [otherMembers, setOtherMembers] = useState<ChatUser[]>([]);
    const [lastMessage, setLastMessage] = useState<Message | undefined>(
        conversation.messages?.[parseInt(process.env.NEXT_PUBLIC_MESSAGES_PER_PAGE || '5')]
    );

    const { user } = useUser();
    const { socket, loadingSocket } = useSocket();
    const { initializeRoomNotifications, newMessageNotification } = useNotification();

    const switchRoom = async (otherMembers: ChatUser[]) => {
        initializeRoomNotifications(conversation._id!);
        await getLastMessages(otherMembers);
    }

    useEffect(() => {
        if (!conversation || !Array.isArray(conversation.members)) {
            setOtherMembers([]);
            return;
        }

        const temp = conversation.members.filter(
            (member: ChatUser) =>
                member.email?.toUpperCase() !== user?.email?.toUpperCase()
        );
        setOtherMembers(temp);
    }, [conversation.members, user?.email]);

    useEffect(() => {
        setLastMessage(conversation.messages?.[conversation.messages.length - 1]);
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
        <li className="shadow-md hover:shadow-lg transition-shadow">
            <button
                type="button"
                className="w-full bg-white dark:bg-gray-800 p-3 flex items-center gap-4 text-left"
                onClick={() => switchRoom(otherMembers)}
            >
                {/* dark:hover:bg-gray-700 (a flat, lighter gray) dropped the
                    row's already-passing text-muted-foreground contrast to
                    4.05:1 on hover, just under 4.5. A subtle white overlay
                    instead - same pattern the navbar's own hover states use -
                    barely lightens the existing dark card, so the text color
                    keeps its normal-state contrast on hover too. */}
                <div className="w-full text-left p-2 flex gap-3 items-center hover:bg-gray-50 dark:hover:bg-white/5">
                {otherMembers.length === 1 ? (
                    <Avatar avatarUrl={otherMembers[0].avatarUrl} nickname={otherMembers[0].nickname} email={otherMembers[0].email} size={48} />
                ) : otherMembers.length > 0 ? (
                    // A group row shows who's actually in it, the same way the
                    // 1:1 row above does - it used to be a single circle of
                    // comma-separated initials, which said far less at a
                    // glance than the members' own pictures.
                    <div className="flex shrink-0 items-center -space-x-3">
                        {otherMembers.slice(0, 3).map(member => (
                            <Avatar
                                key={member._id || member.email}
                                avatarUrl={member.avatarUrl}
                                nickname={member.nickname}
                                email={member.email}
                                size={36}
                                className="ring-2 ring-white dark:ring-gray-800"
                            />
                        ))}
                        {otherMembers.length > 3 && (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 ring-2 ring-white dark:bg-gray-600 dark:text-gray-100 dark:ring-gray-800">
                                +{otherMembers.length - 3}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-center text-[10px] leading-tight text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        No one
                    </div>
                )}


                <div className="flex-1">
                    <div className="grid grid-cols-8 justify-between items-center">
                        <div className="col-span-7">
                            {(otherMembers.map((member, index) => (
                                index < otherMembers.length - 1 ?
                                    <span key={index} className="font-medium">{member.nickname || AsShortName(member.email)}, </span> :
                                    <span key={index} className="font-medium">{member.nickname || AsShortName(member.email)}</span>
                            )))
                            }
                        </div>
                        <div className="col-span-1 justify-self-end">
                            {newMessageNotification[conversation._id!] > 0 && (
                                <div
                                    id={`notificationCount-${conversation._id}`}
                                    className="w-5 h-5 flex items-center justify-center text-white bg-red-600 rounded-full">
                                    {newMessageNotification[conversation._id!]}
                                </div>
                            )}
                        </div>
                    </div>
                    {lastMessage ?
                        <div className="grid grid-cols-2 place-content-between text-muted-foreground">
                            <span>{AsShortName(lastMessage.sender)}</span>
                            <div className="justify-self-end wrap-break-word text-right">
                                {(() => {
                                    const date = new Date(lastMessage.date!);
                                    const now = new Date();

                                    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                                    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                                    const diffDays = (d2 - d1) / 86400000;

                                    if (diffDays === 0) {
                                        return date.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: false
                                        });
                                    }

                                    if (diffDays === 1) {
                                        return "Yesterday";
                                    }

                                    if (diffDays === 2) {
                                        return date.toLocaleDateString([], { weekday: "long" });
                                    }

                                    return date.toLocaleDateString([], {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit"
                                    });
                                })()}
                            </div>
                            <div className="text-sm text-muted-foreground break-all col-span-2">{lastMessage.status?.includes("revoked")
                                ? "Message deleted"
                                : lastMessage.call
                                    ? callRecordSummary(lastMessage.call, lastMessage.sender?.toLowerCase() === user?.email?.toLowerCase())
                                : (lastMessage.text
                                    || (lastMessage.location
                                        ? "Shared a location"
                                        : lastMessage.file?.pathname?.includes("voice-message")
                                            ? "Voice message"
                                            : "sent file " + lastMessage.file?.pathname))}
                            </div>
                        </div>
                        :
                        <div className="text-muted-foreground text-sm italic">
                            No messages yet.
                        </div>
                    }
                    {searchMatch && (
                        <div className="text-sm text-green-700 dark:text-green-400 space-y-0.5">
                            {searchMatch.matches.map((match, index) => (
                                <div key={index} className="break-all italic">
                                    {AsShortName(match.sender)}: {match.text}
                                </div>
                            ))}
                            {searchMatch.moreCount > 0 && (
                                <div className="not-italic text-muted-foreground">
                                    +{searchMatch.moreCount} more match{searchMatch.moreCount === 1 ? '' : 'es'}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
            </button>
        </li>
    );
};

export default ConversationSummary;
