import { Dispatch, RefObject, SetStateAction, useState, useRef, useEffect } from "react";
import { HiOutlineEllipsisHorizontalCircle } from "react-icons/hi2";
import { RiHistoryLine, RiLogoutBoxRLine } from "react-icons/ri";
import useIsMobile from "../hooks/useIsMobile";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { cleanHistory } from "../lib/conversationActions";

interface ChatDropdownProps {
    handleLeaveRoom: () => void;
    chat: Message[];
    setChat: Dispatch<SetStateAction<Message[]>>;
    conversationId: string;
    participants: RefObject<ChatUser[] | null | undefined>;
    setReloadKey: Dispatch<SetStateAction<boolean>>;
}

const ChatDropdown = ({
    handleLeaveRoom,
    chat,
    setChat,
    conversationId,
    participants,
    setReloadKey
}: ChatDropdownProps) => {
    const isMobile = useIsMobile();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!showDropdown) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showDropdown]);

    const handleCleanHistory = async () => {
        if (chat.length === 0) return;

        try {
            const response = await cleanHistory(conversationId);
            if (response.success) {
                setChat([]);
                setReloadKey(prev => !prev);
                setShowDropdown(false);
            }
        } catch (error: any) {
            window.alert("Error occurred while cleaning chat history: " + error);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="py-1 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center justify-center"
            >
                <HiOutlineEllipsisHorizontalCircle
                    color="rgb(152, 65, 249)"
                    size={isMobile ? 26 : 40}
                />
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 w-48">
                    <button
                        onClick={handleCleanHistory}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <RiHistoryLine size={18} /> Clear Room History
                    </button>
                    <hr className="my-1 -mx-1 border-stone-300" />
                    <button
                        onClick={handleLeaveRoom}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        disabled={!participants.current}
                    >
                        <RiLogoutBoxRLine size={18} /> Leave Room
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatDropdown;