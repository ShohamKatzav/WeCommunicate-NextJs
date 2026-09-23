import { RefObject, useState, useRef, useEffect } from "react";
import { HiOutlineEllipsisHorizontalCircle, HiOutlineUsers } from "react-icons/hi2";
import { RiHistoryLine, RiLogoutBoxRLine } from "react-icons/ri";
import { MdDeleteForever } from "react-icons/md";
import { Timer } from "lucide-react";
import Message from "@/types/message";
import ChatUser from "@/types/chatUser";
import { cleanHistory, deleteConversation } from "../../lib/conversationActions";
import DeleteConversationModal from "./deleteConversationModal";
import DisappearingMessagesModal from "./disappearingMessagesModal";
import { toast } from "sonner";
import ConversationDetailsModal from "./conversationDetailsModal";

interface ChatDropdownProps {
    handleLeaveRoom: () => void;
    chat: Message[];
    setChat: (newChat: Message[]) => void;
    conversationId: string;
    ensureConversationId: () => Promise<string>;
    participants: RefObject<ChatUser[] | null | undefined>;
    updateConversationsBar: (message: Message | null, mode?: string, cleanId?: string) => Promise<void>;
    onDisappearingMessagesChange?: (seconds: number) => void;
    setPendingClear: (conversationId: string, clearedAt: string) => void;
}

const ChatDropdown = ({
    handleLeaveRoom,
    chat,
    setChat,
    conversationId,
    ensureConversationId,
    participants,
    updateConversationsBar,
    onDisappearingMessagesChange,
    setPendingClear
}: ChatDropdownProps) => {

    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [showDisappearingMessagesModal, setShowDisappearingMessagesModal] = useState(false);
    // The id resolved (created on demand, if this chat has no messages yet)
    // when the option is opened - not the conversationId prop, since that's
    // still empty for a brand-new chat until ensureConversationId runs.
    const [disappearingMessagesConversationId, setDisappearingMessagesConversationId] = useState<string | null>(null);
    const [isOpeningDisappearingMessages, setIsOpeningDisappearingMessages] = useState(false);

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

        // Captured now, not at flush time - this is what actually drives
        // what stays hidden (see the cutoff rules in
        // CleanHistoryRepository.updateCleanHistory / app/api/cleanhistory/
        // route.ts). Passed to the server action purely so the service
        // worker can pull it out of the request body and queue it; the live
        // online call below ignores it and always writes server time.
        const clearedAt = new Date().toISOString();

        try {
            const result = await cleanHistory(conversationId, "cleanHistory", clearedAt);
            if (result.success) {
                setChat([]);
                updateConversationsBar(null, "Clean", conversationId);
            }
        } catch (error: any) {
            // Same offline signals useMessageHandling's handleSendMessage
            // uses, plus the "Unexpected response" case a server action can
            // throw under the service worker's queued 503 (see
            // moreMessagesLoader.tsx's loadMoreMessages, which treats it the
            // same way).
            const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine)
                || error?.name === 'TypeError'
                || error?.message?.includes('Failed to fetch')
                || error?.message?.includes('Unexpected response');

            if (isOffline) {
                // No optimistic update was enough on its own here - without
                // a locally-persisted cutoff, every other surface that reads
                // this conversation's history (rehydration, pagination,
                // search, incoming/synced messages) would keep showing what
                // was "cleared" until the offline queue actually flushes.
                setPendingClear(conversationId, clearedAt);
                setChat([]);
                updateConversationsBar(null, "Clean", conversationId);
                toast.info("Offline right now - history is cleared on this device and will sync once you’re back online.");
            } else {
                toast.error("Failed to clear history");
            }
        }
        finally {
            setShowDropdown(false);
        }
    };

    const handleDeleteConversation = async () => {
        if (!conversationId) {
            handleLeaveRoom();
            return;
        }
        setIsDeleting(true);
        try {
            await deleteConversation(conversationId, "conversation");
        } catch (error: any) {
            toast.info("You’re offline. I’ll delete this conversation once the connection is restored.");
        } finally {
            setShowDeleteModal(false);
            setIsDeleting(false);
            await updateConversationsBar(null, "Delete", conversationId);
            handleLeaveRoom();
            setShowDropdown(false);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Same box as the header's other icon buttons (chatHeader.tsx):
                44px on phones, 40px from md up. */}
            <button
                id="dropdown-button"
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                aria-label="Conversation options"
                aria-expanded={showDropdown}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-purple-500 md:h-10 md:w-10 dark:hover:bg-gray-700"
            >
                <HiOutlineEllipsisHorizontalCircle
                    color="rgb(152, 65, 249)"
                    size={26}
                    aria-hidden="true"
                />
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 w-48">

                    <button
                        onClick={() => {
                            setShowParticipantsModal(true);
                            setShowDropdown(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <HiOutlineUsers size={18} /> Conversation Details
                    </button>
                    <hr className="my-0 border-stone-200 dark:border-gray-700" />
                    <button
                        onClick={handleLeaveRoom}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        disabled={!participants.current}
                    >
                        <RiLogoutBoxRLine size={18} /> Leave Room
                    </button>
                    <hr className="my-0 border-stone-200 dark:border-gray-700" />
                    <button
                        onClick={handleCleanHistory}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <RiHistoryLine size={18} /> Clear Room History
                    </button>
                    <hr className="my-0 border-stone-200 dark:border-gray-700" />
                    <button
                        onClick={async () => {
                            setShowDropdown(false);
                            // A chat with no messages yet has no Conversation
                            // document - create it now instead of leaving
                            // this option disabled until a first message.
                            setIsOpeningDisappearingMessages(true);
                            const id = await ensureConversationId();
                            setIsOpeningDisappearingMessages(false);
                            if (!id) {
                                toast.error("Couldn't open this setting. Please try again.");
                                return;
                            }
                            setDisappearingMessagesConversationId(id);
                            setShowDisappearingMessagesModal(true);
                        }}
                        disabled={!participants.current?.length || isOpeningDisappearingMessages}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Timer size={18} /> Disappearing Messages
                    </button>
                    <hr className="my-0 border-stone-200 dark:border-gray-700" />
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-destructive hover:bg-red-100 dark:hover:bg-gray-700"
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
            {showParticipantsModal && (
                <ConversationDetailsModal
                    participants={participants}
                    setShowParticipantsModal={setShowParticipantsModal}
                />
            )}
            {showDisappearingMessagesModal && disappearingMessagesConversationId && (
                <DisappearingMessagesModal
                    conversationId={disappearingMessagesConversationId}
                    onClose={() => setShowDisappearingMessagesModal(false)}
                    onSaved={onDisappearingMessagesChange}
                />
            )}
        </div>
    );
};

export default ChatDropdown;