import ChatUser from "@/types/chatUser";
import { SetStateAction, useEffect, useState } from "react";
import { HiChatBubbleLeftRight, HiUsers } from "react-icons/hi2";
import { AsShortName } from "../utils/stringFormat";
import { useUser } from "../hooks/useUser";
import ChatDropdown from "./chatDropdown";
import Message from "@/types/message";

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
    activeSocketUsers }: ChatHeaderProps) => {

    const { user } = useUser();

    const [onlineCount, setOnlineCount] = useState(0);

    useEffect(() => {
        getOnlineParticipantsInRoom();
    }, [participants.current, activeSocketUsers, conversationId]);

    const getOnlineParticipantsInRoom = () => {
        if (!participants.current) return [];
        const count = participants.current.filter(p =>
            activeSocketUsers.some(active => active.email === p.email)
        ).length;
        setOnlineCount(count);
    };

    return (
        < div className="grid-cols-12 md:flex md:items-center gap-3 p-3 border-b dark:border-gray-700" >
            <div className="flex items-center gap-3 w-full">
                {/* Mobile open chats */}
                <button
                    onClick={() => setMobileChatsSidebarOpen(true)}
                    className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <HiChatBubbleLeftRight color="rgb(152, 65, 249)" size={26} />
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h1 className="text-xl md:text-3xl font-bold mb-1 truncate">
                            <span className="bg-clip-text bg-linear-to-r from-blue-500 to-purple-600 text-transparent">
                                {"Welcome " + AsShortName(user?.email as string)}
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
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <span className={`w-1.5 h-1.5 bg-${onlineCount > 0 ? 'green' : 'gray'}-500 rounded-full`}></span>
                                    {participants.current.length > 1 ? `${onlineCount} of ${participants.current.length} members online` :
                                        `${onlineCount > 0 ? `${AsShortName(participants.current[0]?.email as string)} online` :
                                            `${AsShortName(participants.current[0]?.email as string)} isn't here right now`}`
                                    }
                                </div>
                            )
                        )}

                        {!participants.current && (
                            <div className="text-xs text-green-500 font-medium">Select a chat to start</div>
                        )}
                    </div>
                </div>

                <div className="grid">
                    <button
                        onClick={() => setMobileUsersSidebarOpen(true)}
                        className="py-1 md:hidden md:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                            updateConversationsBar={updateConversationsBar} />
                    }
                </div>
            </div>
        </div >
    );
};
export default ChatHeader;