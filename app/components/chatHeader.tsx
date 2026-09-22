import ChatUser from "@/types/chatUser";
import Link from "next/link";
import { SetStateAction, useEffect, useState } from "react";
import { HiChatBubbleLeftRight, HiUsers } from "react-icons/hi2";
import { Timer } from "lucide-react";
import { AsShortName } from "../utils/stringFormat";
import { formatLastSeen } from "../utils/lastSeen";
import { useUser } from "../hooks/useUser";
import ChatDropdown from "./chatDropdown";
import Avatar from "./avatar";
import Message from "@/types/message";
import { getDisappearingMessagesSetting } from "../lib/conversationActions";
import { DISAPPEARING_MESSAGES_OPTIONS } from "../config/limits";

interface ChatHeaderProps {
    setMobileChatsSidebarOpen: (value: SetStateAction<boolean>) => void;
    setMobileUsersSidebarOpen: (value: SetStateAction<boolean>) => void;
    participants: React.RefObject<ChatUser[] | null | undefined>;
    handleLeaveRoom: () => Promise<void>;
    chat: Message[];
    setChat: (newChat: Message[]) => void;
    conversationId: string;
    updateConversationsBar: (message: Message | null, mode?: string, cleanId?: string) => Promise<void>;
    typingUsers: Record<string, boolean>;
    activeSocketUsers: ChatUser[];
    setPendingClear: (conversationId: string, clearedAt: string) => void;
    lastSeenByEmail: Record<string, string>;
    isBlocked: boolean;
}

const ChatHeader = ({
    setMobileChatsSidebarOpen,
    setMobileUsersSidebarOpen,
    participants,
    handleLeaveRoom,
    chat,
    setChat,
    conversationId,
    updateConversationsBar,
    typingUsers,
    activeSocketUsers,
    setPendingClear,
    lastSeenByEmail,
    isBlocked }: ChatHeaderProps) => {

    const { user } = useUser();

    const [onlineCount, setOnlineCount] = useState(0);
    // Without this the disappearing-messages setting is invisible once set -
    // you'd have to reopen the dropdown to remember whether this conversation
    // is on a timer. Kept in sync on save via onDisappearingMessagesChange
    // below, so it never shows a stale value.
    const [disappearingSeconds, setDisappearingSeconds] = useState(0);

    useEffect(() => {
        getOnlineParticipantsInRoom();
    }, [participants.current, activeSocketUsers, conversationId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!conversationId) {
                if (!cancelled) setDisappearingSeconds(0);
                return;
            }
            const result = await getDisappearingMessagesSetting(conversationId);
            if (!cancelled) setDisappearingSeconds(result.success ? result.seconds : 0);
        })();
        return () => { cancelled = true; };
    }, [conversationId]);

    const disappearingLabel = DISAPPEARING_MESSAGES_OPTIONS
        .find(option => option.seconds === disappearingSeconds && option.seconds !== 0)?.label;

    // 1:1 only - a group has several people with several last-seen times,
    // and the header already summarises those as "N of M members online".
    // Never shown for a blocked user, matching the users list.
    const otherParticipant = participants.current?.length === 1 ? participants.current[0] : undefined;
    const lastSeenText = (!otherParticipant || isBlocked)
        ? null
        : formatLastSeen(
            (otherParticipant.email ? lastSeenByEmail[otherParticipant.email.toLowerCase()] : undefined)
            ?? otherParticipant.lastSeen
        );

    const getOnlineParticipantsInRoom = () => {
        if (!participants.current) return [];
        const count = participants.current.filter(p =>
            activeSocketUsers.some(active => active.email === p.email)
        ).length;
        setOnlineCount(count);
    };

    return (
        < div className="grid-cols-12 xl:flex xl:items-center gap-3 p-3 border-b dark:border-gray-700" >
            <div className="flex items-center gap-3 w-full">
                {/* Mobile open chats */}
                <button
                    onClick={() => setMobileChatsSidebarOpen(true)}
                    className="xl:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <HiChatBubbleLeftRight color="rgb(152, 65, 249)" size={26} />
                </button>

                {participants.current?.length === 1 && (
                    <Link
                        href={`/profile/${participants.current[0]._id}`}
                        aria-label={`View ${participants.current[0].nickname || AsShortName(participants.current[0].email)}'s profile`}
                        className="shrink-0"
                    >
                        <Avatar
                            avatarUrl={participants.current[0].avatarUrl}
                            nickname={participants.current[0].nickname}
                            email={participants.current[0].email}
                            size={40}
                        />
                    </Link>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h1 className="text-xl xl:text-3xl font-bold mb-1 truncate">
                            <span className="bg-clip-text bg-linear-to-r from-blue-600 to-purple-700 dark:from-blue-300 dark:to-purple-400 text-transparent">
                                {"Welcome " + (user?.nickname || AsShortName(user?.email as string))}
                            </span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 h-5 mt-0.5" id="ConversationInfo">
                        {Object.keys(typingUsers).length > 0 ? (
                            <div className="flex items-center gap-1.5 transition-all duration-300">
                                <div className="flex gap-0.5">
                                    <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium italic">
                                    {Object.keys(typingUsers).length === 1
                                        ? `${AsShortName(Object.keys(typingUsers)[0])} is typing...`
                                        : "Multiple people are typing..."
                                    }
                                </span>
                            </div>
                        ) : (

                            participants.current && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                                    <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${onlineCount > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                    <span className="truncate">
                                        {participants.current.length > 1
                                            ? `${onlineCount} of ${participants.current.length} members online`
                                            : onlineCount > 0
                                                ? `${otherParticipant?.nickname || AsShortName(otherParticipant?.email as string)} online`
                                                : lastSeenText
                                                    ? `${otherParticipant?.nickname || AsShortName(otherParticipant?.email as string)} · Last seen ${lastSeenText}`
                                                    : `${otherParticipant?.nickname || AsShortName(otherParticipant?.email as string)} isn't here right now`
                                        }
                                    </span>
                                </div>
                            )
                        )}

                        {!participants.current && (
                            <div className="text-xs text-success font-medium">Select a chat to start</div>
                        )}

                        {disappearingLabel && (
                            <span
                                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400"
                                title={`New messages disappear after ${disappearingLabel}`}
                            >
                                <Timer size={12} aria-hidden="true" />
                                {disappearingLabel}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid">
                    <button
                        onClick={() => setMobileUsersSidebarOpen(true)}
                        className="py-1 xl:hidden xl:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <HiUsers color="rgb(152, 65, 249)" size={26} />
                    </button>

                    {
                        participants.current &&
                        <ChatDropdown
                            handleLeaveRoom={handleLeaveRoom}
                            chat={chat}
                            setChat={setChat}
                            conversationId={conversationId}
                            participants={participants}
                            updateConversationsBar={updateConversationsBar}
                            onDisappearingMessagesChange={setDisappearingSeconds}
                            setPendingClear={setPendingClear} />
                    }
                </div>
            </div>
        </div >
    );
};
export default ChatHeader;
