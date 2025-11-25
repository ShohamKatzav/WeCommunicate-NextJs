import { Dispatch, RefObject, SetStateAction, useState, useRef, useEffect } from "react";
import { HiOutlineEllipsisHorizontalCircle } from "react-icons/hi2";
import { RiHistoryLine, RiLogoutBoxRLine } from "react-icons/ri";
import { MdDeleteForever } from "react-icons/md";
import useIsMobile from "../hooks/useIsMobile";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { cleanHistory, deleteConversation } from "../lib/conversationActions"; // <-- ADD YOUR DELETE FN
import { useReloadConversationBar } from "../hooks/useReloadConversationBar";
import { useRouter } from 'next/navigation'
import DeleteConversationModal from "./deleteConversationModal";

interface ChatDropdownProps {
    handleLeaveRoom: () => void;
    chat: Message[];
    setChat: Dispatch<SetStateAction<Message[]>>;
    conversationId: string;
    participants: RefObject<ChatUser[] | null | undefined>;
}

const ChatDropdown = ({
    handleLeaveRoom,
    chat,
    setChat,
    conversationId,
    participants
}: ChatDropdownProps) => {

    const isMobile = useIsMobile();
    const { updateReloadKey } = useReloadConversationBar();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const router = useRouter();

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Close dropdown when delete modal open/close
    useEffect(() => {
        setShowDropdown(false);
    }, [showDeleteModal]);

    // Close dropdown when clicking outside the dropdown
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
                setShowDropdown(false);
                router.refresh();
                updateReloadKey();
            }
        } catch (error: any) {
            window.alert("Error occurred while cleaning chat history: " + error);
        }
    };

    const handleDeleteConversation = async () => {
        if (!conversationId) {
            handleLeaveRoom();
            return;
        }
        setIsDeleting(true);
        try {
            const response = await deleteConversation(conversationId);
            if (response.success) {
                setShowDeleteModal(false);
                setShowDropdown(false);
                router.refresh();
                updateReloadKey();
                handleLeaveRoom();
            }
        } catch (error: any) {
            console.error("Error deleting conversation:", error);
        } finally {
            setIsDeleting(false);
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
                        onClick={handleLeaveRoom}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        disabled={!participants.current}
                    >
                        <RiLogoutBoxRLine size={18} /> Leave Room
                    </button>
                    <hr className="my-1 -mx-1 border-stone-300" />
                    <button
                        onClick={handleCleanHistory}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <RiHistoryLine size={18} /> Clear Room History
                    </button>
                    <hr className="my-1 -mx-1 border-stone-300" />
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-gray-700"
                    >
                        <MdDeleteForever size={18} /> Delete Conversation
                    </button>
                </div>
            )}
            {showDeleteModal && (
                <DeleteConversationModal
                    isOpen={showDeleteModal}
                    isDeleting={isDeleting}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteConversation}
                />
            )}
        </div>
    );
};

export default ChatDropdown;