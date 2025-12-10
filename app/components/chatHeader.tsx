import ChatUser from "@/types/chatUser";
import { Dispatch, SetStateAction } from "react";
import { HiChatBubbleLeftRight, HiOutlineChatBubbleOvalLeft, HiUsers } from "react-icons/hi2";
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
}

const ChatHeader = ({ setMobileChatsSidebarOpen, setMobileUsersSidebarOpen, participants, handleLeaveRoom, chat, setChat, conversationId, updateConversationsBar }: ChatHeaderProps) => {

    const { user } = useUser();

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

                    {!participants.current &&
                        <div className="text-sm md:text-md text-green-500">{'Select a chat to start'}</div>
                    }

                    {participants.current?.length! > 0 &&
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <HiOutlineChatBubbleOvalLeft size={22} />
                            <span className="text-wrap">
                                Chatting with:{" "}
                                {participants.current?.map((p, i) => (
                                    <span key={i}>{AsShortName(p.email!)}{i < participants.current?.length! - 1 ? ", " : ""}</span>
                                ))}
                            </span>
                        </div>
                    }
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