import ChatUser from "@/types/chatUser";
import Link from "next/link";
import { rememberChatForProfile } from "../../utils/chatReturn";
import { Dispatch, RefObject, SetStateAction } from "react";
import { AsShortName } from "../../utils/stringFormat";
import Avatar from "../ui/avatar";
import { useT } from "../../i18n/client";

interface ConversationDetailsModalProps {
    participants: RefObject<ChatUser[] | null | undefined>;
    setShowParticipantsModal: Dispatch<SetStateAction<boolean>>;
}


const ConversationDetailsModal = ({ participants, setShowParticipantsModal }: ConversationDetailsModalProps) => {
    const t = useT();
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" id="conversation-details-modal">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-semibold text-lg">{t("chat.details.title")}</h3>
                    <button
                        onClick={() => setShowParticipantsModal(false)}
                        aria-label={t("chat.details.close")}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {participants.current && participants.current.length > 0 ? (
                        participants.current.map((user: ChatUser) => user.deleted ? (
                            // A deleted account has no profile to open.
                            <div key={user._id} className="flex items-center gap-3 p-2">
                                <Avatar deleted size={40} />
                                <p className="text-sm font-medium text-muted-foreground">{t("chat.deletedAccount")}</p>
                            </div>
                        ) : (
                            <Link
                                key={user._id}
                                href={`/profile/${user._id}`}
                                onClick={() => {
                                    rememberChatForProfile(user._id);
                                    setShowParticipantsModal(false);
                                }}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                            >
                                <Avatar avatarUrl={user.avatarUrl} nickname={user.nickname} email={user.email} size={40} />
                                <div>
                                    <p className="text-sm font-medium dark:text-white">{user.nickname || AsShortName(user.email)}</p>
                                    <p className="text-xs text-muted-foreground">{user.email ? <bdi dir="ltr">{user.email}</bdi> : t("chat.details.participant")}</p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className="text-center py-4 text-muted-foreground">{t("chat.details.none")}</p>
                    )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 text-end">
                    <button
                        onClick={() => setShowParticipantsModal(false)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                    >
                        {t("chat.details.close")}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConversationDetailsModal;