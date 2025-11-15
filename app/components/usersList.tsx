"use client"
import { useEffect, useRef, useState } from "react";
import { createCoockieChatUsersList, getCoockieChatUsersList } from "../lib/cookieActions";
import { getUsernames } from '@/app/lib/accountActions'
import useIsMobile from "../hooks/useIsMobile";
import { useUser } from "../hooks/useUser";
import { useSocket } from "../hooks/useSocket";
import { useNotification } from "../hooks/useNotification";
import ChatUser from "@/types/chatUser";
import ciEquals from "../utils/ciEqual";
import UserRow from "./userRow";
import { Users } from 'lucide-react';

interface ListProps {
    chatListActiveUsers: ChatUser[];
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    conversationId: string | undefined;
    isMobileUsersSidebarOpen: boolean;
}

const UsersList = ({ chatListActiveUsers, getLastMessages, conversationId, isMobileUsersSidebarOpen }: ListProps) => {

    const { user } = useUser();
    const { initializeRoomNotifications } = useNotification();
    const [chatListAllUsers, setChatListAllUsers] = useState<ChatUser[]>([]);

    useEffect(() => {
        // don't try to fetch usernames until user data (and token) is loaded
        if (user?.email) {
            init();
        }
    }, [chatListActiveUsers, user?.email]);

    useEffect(() => {
        if (conversationId)
            initializeRoomNotifications(conversationId);
    }, [conversationId]);

    const init = async () => {
        // guard: ensure user (and token) exists before making authenticated request
        if (!user?.email) return;
        const chatUsers = await getCoockieChatUsersList();
        if (chatUsers === undefined) {
            const response: any = await getUsernames();
            createCoockieChatUsersList(response);
            setChatListAllUsers(response);
        }
        else {
            const updatedChatUsers: ChatUser[] = JSON.parse(chatUsers.value);
            chatListActiveUsers?.forEach(user => {
                if (!updatedChatUsers?.find(u => ciEquals(u.email as string, user.email as string)))
                    updatedChatUsers.push(user);
            });
            createCoockieChatUsersList(updatedChatUsers);
            setChatListAllUsers(updatedChatUsers);
        }
    }


    const isUserActive = (user: ChatUser) => {
        return chatListActiveUsers?.some(u => ciEquals(u.email as string, user.email as string));
    }

    const onlineUsers = chatListAllUsers.filter(
        u => u.email?.toLowerCase() !== user?.email?.toLowerCase() && isUserActive(u)
    );

    const offlineUsers = chatListAllUsers.filter(
        u => u.email?.toLowerCase() !== user?.email?.toLowerCase() && !isUserActive(u)
    );

    return (
        <div
            className={`${isMobileUsersSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                md:translate-x-0 fixed md:relative right-0 z-20
                w-80 md:w-1/8 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
                transition-transform duration-300 ease-in-out h-full flex flex-col shadow-xl
                `}>
            <aside className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform duration-300">
                <div className="px-3 py-2 text-xs text-green-600 dark:text-green-400 font-semibold">
                    Active now
                </div>
                {onlineUsers.length > 0 ?
                    onlineUsers.map((chatUser: ChatUser, index) => (
                        <UserRow key={`on-${index}`} chatUser={chatUser} getLastMessages={getLastMessages} active={true} />
                    ))
                    :
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active users</p>
                    </div>
                }

                {/* Offline section */}
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-semibold mt-3">
                    Others
                </div>
                {offlineUsers.length > 0 ?
                    offlineUsers.map((chatUser: ChatUser, index) => (
                        <UserRow key={`off-${index}`} chatUser={chatUser} getLastMessages={getLastMessages} active={false} />
                    ))
                    :
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No inactive users</p>
                    </div>
                }
            </aside>
        </div>
    );

};

export default UsersList;