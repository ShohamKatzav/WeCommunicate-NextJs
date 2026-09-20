import { ShieldOff, ShieldCheck } from "lucide-react";
import ChatUser from "@/types/chatUser";
import { AsShortName } from "../utils/stringFormat";
import { useSocket } from "../hooks/useSocket";

interface ListProps {
    chatUser: ChatUser;
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    active?: boolean;
    isBlocked: boolean;
    onToggleBlock: (targetUserId: string, shouldBlock: boolean) => Promise<void>;
}

const UsersRow = ({ chatUser, getLastMessages, active, isBlocked, onToggleBlock }: ListProps) => {

    const { socket } = useSocket();

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
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold">
                        {(chatUser.nickname || AsShortName(chatUser.email || ''))[0]}
                    </div>
                    {
                        active ?
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div> :
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    }

                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                        {chatUser.nickname || AsShortName(chatUser.email || '')}
                    </div>
                    {
                        isBlocked ?
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Blocked
                            </div> :
                            active ?
                                <div className="text-xs text-green-600 dark:text-green-400">
                                    Online
                                </div> :
                                <div className="text-xs text-red-600 dark:text-red-400">
                                    Offline
                                </div>
                    }
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleBlock(chatUser._id, !isBlocked);
                    }}
                    aria-label={isBlocked ? `Unblock ${chatUser.nickname || chatUser.email}` : `Block ${chatUser.nickname || chatUser.email}`}
                    title={isBlocked ? 'Unblock' : 'Block'}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                >
                    {isBlocked ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                </button>
            </div>
        </div></>)
}

export default UsersRow;
