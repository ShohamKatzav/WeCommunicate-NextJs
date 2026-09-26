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
import { memberName } from "../../utils/memberName";
import Avatar from "../ui/avatar";
import FitName from "../ui/fitName";
import { useT } from "../../i18n/client";

interface ConversationConversationSummaryProps {
    conversation: Conversation;
    getLastMessages: (participantsFromList: ChatUser[]) => Promise<void>;
    searchMatch?: MessageSearchResult;
}

const ConversationSummary = ({ conversation, getLastMessages, searchMatch }: ConversationConversationSummaryProps) => {
    const t = useT();

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

        const handleEditedMessage = (edit: Pick<Message, '_id' | 'text'>) => {
            if (lastMessage?._id !== edit?._id || typeof edit.text !== 'string') return;
            const text = edit.text;
            setLastMessage(prev => prev ? { ...prev, text, edited: true } : prev);
        };

        socket.on("delete message", handleDeletedMessage);
        socket.on("edit message", handleEditedMessage);

        return () => {
            socket.off("delete message", handleDeletedMessage);
            socket.off("edit message", handleEditedMessage);
        };
    }, [socket, loadingSocket, lastMessage?._id]);

    return (
        <li className="shadow-md hover:shadow-lg transition-shadow">
            <button
                type="button"
                className="flex w-full min-w-0 items-center gap-4 bg-white p-3 text-start dark:bg-gray-800"
                onClick={() => switchRoom(otherMembers)}
            >
                {/* dark:hover:bg-gray-700 (a flat, lighter gray) dropped the
                    row's already-passing text-muted-foreground contrast to
                    4.05:1 on hover, just under 4.5. A subtle white overlay
                    instead - same pattern the navbar's own hover states use -
                    barely lightens the existing dark card, so the text color
                    keeps its normal-state contrast on hover too. */}
                <div className="flex w-full min-w-0 items-center gap-3 p-2 text-start hover:bg-gray-50 dark:hover:bg-white/5">
                {otherMembers.length === 1 ? (
                    <Avatar avatarUrl={otherMembers[0].avatarUrl} nickname={otherMembers[0].nickname} email={otherMembers[0].email} deleted={otherMembers[0].deleted} size={48} className="shrink-0" />
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
                                deleted={member.deleted}
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
                        {t("chat.sidebar.noOne")}
                    </div>
                )}


                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                        {/* The names as they are, fitted to the column - wrapped at
                            natural points, then shrunk, and only cut short as a
                            last resort (see FitName). A group's names are one
                            comma-joined line. */}
                        <FitName
                            text={otherMembers.map(member => memberName(member, t)).join(", ")}
                            fullText={otherMembers.map(member => member.nickname?.trim() || member.email || memberName(member, t)).join(", ")}
                            className="min-w-0 flex-1 font-medium"
                            testId="conversation-name"
                        />
                        {newMessageNotification[conversation._id!] > 0 && (
                            <div
                                id={`notificationCount-${conversation._id}`}
                                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white">
                                {newMessageNotification[conversation._id!]}
                            </div>
                        )}
                    </div>
                    {lastMessage ?
                        <div className="text-muted-foreground">
                            <div className="flex items-baseline gap-2">
                            {/* A notice from the app has no sender to name. */}
                            <span className="min-w-0 flex-1 truncate">{lastMessage.system ? "" : AsShortName(lastMessage.sender)}</span>
                            <div className="shrink-0 text-end">
                                {(() => {
                                    const date = new Date(lastMessage.date!);
                                    const now = new Date();

                                    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                                    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                                    const diffDays = (d2 - d1) / 86400000;

                                    if (diffDays === 0) {
                                        return date.toLocaleTimeString(t.dateLocale, {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            hour12: false
                                        });
                                    }

                                    if (diffDays === 1) {
                                        return t("dates.yesterday");
                                    }

                                    if (diffDays === 2) {
                                        return date.toLocaleDateString(t.dateLocale, { weekday: "long" });
                                    }

                                    return date.toLocaleDateString(t.dateLocale, {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "2-digit"
                                    });
                                })()}
                            </div>
                            </div>
                            <div className="text-sm text-muted-foreground wrap-break-word line-clamp-2"><span dir="auto">{lastMessage.system === "account-deleted"
                                ? t("chat.preview.accountDeleted")
                                : lastMessage.status?.includes("revoked")
                                ? t("chat.preview.deleted")
                                : lastMessage.call
                                    ? callRecordSummary(lastMessage.call, lastMessage.sender?.toLowerCase() === user?.email?.toLowerCase(), t)
                                : (lastMessage.text
                                    || (lastMessage.location
                                        ? t("chat.preview.location")
                                        : lastMessage.file?.pathname?.includes("voice-message")
                                            ? t("chat.preview.voice")
                                            : t("chat.preview.file", { name: lastMessage.file?.pathname ?? "" })))}
                            </span></div>
                        </div>
                        :
                        <div className="text-muted-foreground text-sm italic">
                            {t("chat.sidebar.noMessages")}
                        </div>
                    }
                    {searchMatch && (
                        <div className="text-sm text-green-700 dark:text-green-400 space-y-0.5">
                            {searchMatch.matches.map((match, index) => (
                                <div key={index} className="break-all italic">
                                    {AsShortName(match.sender)}: <span dir="auto">{match.text}</span>
                                </div>
                            ))}
                            {searchMatch.moreCount > 0 && (
                                <div className="not-italic text-muted-foreground">
                                    {t("chat.sidebar.moreMatches", { count: searchMatch.moreCount })}
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
