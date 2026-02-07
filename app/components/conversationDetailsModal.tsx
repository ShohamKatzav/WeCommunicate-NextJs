import ChatUser from "@/types/chatUser";
import { Dispatch, RefObject, SetStateAction } from "react";
import { AsShortName } from "../utils/stringFormat";

interface ConversationDetailsModalProps {
    participants: RefObject<ChatUser[] | null | undefined>;
    setShowParticipantsModal: Dispatch<SetStateAction<boolean>>;
}


const ConversationDetailsModal = ({ participants, setShowParticipantsModal }: ConversationDetailsModalProps) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" id="conversation-details-modal">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Participants</h3>
                    <button
                        onClick={() => setShowParticipantsModal(false)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                        ✕
                    </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {participants.current && participants.current.length > 0 ? (
                        participants.current.map((user: ChatUser) => (
                            <div key={user._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                                    {user.email?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <p className="text-sm font-medium dark:text-white">{AsShortName(user.email)}</p>
                                    <p className="text-xs text-gray-500">{user.email || 'Participant'}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-4 text-gray-500">No participants found.</p>
                    )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 text-right">
                    <button
                        onClick={() => setShowParticipantsModal(false)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConversationDetailsModal;