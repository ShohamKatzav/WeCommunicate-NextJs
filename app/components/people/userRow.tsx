import Link from "next/link";
import { ShieldOff, ShieldCheck } from "lucide-react";
import ChatUser from "@/types/chatUser";
import { AsShortName } from "../../utils/stringFormat";
import { formatLastSeen } from "../../utils/lastSeen";
import { useT } from "../../i18n/client";
import { useSocket } from "../../hooks/useSocket";
import Avatar from "../ui/avatar";

interface ListProps {
    chatUser: ChatUser;
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    active?: boolean;
    isBlocked: boolean;
    onToggleBlock: (targetUserId: string, shouldBlock: boolean) => Promise<void>;
    lastSeen?: string | Date;
}

const UsersRow = ({ chatUser, getLastMessages, active, isBlocked, onToggleBlock, lastSeen }: ListProps) => {
    const t = useT();

    const { socket } = useSocket();
    // Never for a blocked user: how recently someone was around is exactly
    // the kind of visibility blocking them is meant to end.
    const lastSeenText = isBlocked ? null : formatLastSeen(lastSeen, t);

    const switchRoom = async (participant: ChatUser) => {
        if (socket && participant) {
            await getLastMessages([participant]);
        }
    };

    return (<>
        <div
            onClick={() => switchRoom(chatUser)}
            className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Link
                        href={`/profile/${chatUser._id}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t("people.viewProfile", { name: chatUser.nickname || AsShortName(chatUser.email || '') })}
                    >
                        <Avatar avatarUrl={chatUser.avatarUrl} nickname={chatUser.nickname} email={chatUser.email} size={40} />
                    </Link>
                    {
                        active ?
                            <div className="absolute bottom-0 end-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div> :
                            <div className="absolute bottom-0 end-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    }

                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                        {chatUser.nickname || AsShortName(chatUser.email || '')}
                    </div>
                    {
                        isBlocked ?
                            <div className="text-xs text-muted-foreground">
                                {t("people.blocked")}
                            </div> :
                            active ?
                                <div className="text-xs text-success">
                                    {t("presence.online")}
                                </div> :
                                lastSeenText ?
                                    <div className="text-xs text-muted-foreground truncate">
                                        {lastSeenText}
                                    </div> :
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                        {t("presence.offline")}
                                    </div>
                    }
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleBlock(chatUser._id, !isBlocked);
                    }}
                    aria-label={isBlocked ? t("people.unblockUser", { name: chatUser.nickname || chatUser.email || '' }) : t("people.blockUser", { name: chatUser.nickname || chatUser.email || '' })}
                    title={isBlocked ? t("people.unblock") : t("people.block")}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-muted-foreground hover:text-foreground shrink-0"
                >
                    {isBlocked ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                </button>
            </div>
        </div></>)
}

export default UsersRow;
