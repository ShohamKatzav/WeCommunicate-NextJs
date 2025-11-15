import ChatUser from "@/types/chatUser";
import { AsShortName } from "../utils/asName";
import { useSocket } from "../hooks/useSocket";

interface ListProps {
    chatUser: ChatUser;
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    active?: boolean;
}

const UsersRow = ({ chatUser, getLastMessages, active }: ListProps) => {

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
                        {AsShortName(chatUser.email || '')[0]}
                    </div>
                    {
                        active ?
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div> :
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    }

                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                        {AsShortName(chatUser.email || '')}
                    </div>
                    {
                        active ?
                            <div className="text-xs text-green-600 dark:text-green-400">
                                Online
                            </div> :
                            <div className="text-xs text-red-600 dark:text-red-400">
                                Offline
                            </div>
                    }
                </div>
            </div>
        </div></>)
}

export default UsersRow;