"use client"
import { useEffect, useMemo, useRef } from "react";
import { useUser } from "../hooks/useUser";
import { useNotification } from "../hooks/useNotification";
import ChatUser from "@/types/chatUser";
import ciEquals from "../utils/ciEqual";
import UserRow from "./userRow";
import { Users } from 'lucide-react';

interface UsersListClientProps {
    initialUsers: ChatUser[];
    chatListActiveUsers: ChatUser[];
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    conversationId?: string | undefined;
    isMobileUsersSidebarOpen: boolean;
}

export default function UsersListClient({
    initialUsers,
    chatListActiveUsers,
    getLastMessages,
    conversationId,
    isMobileUsersSidebarOpen,
}: UsersListClientProps) {
    const { user } = useUser();
    const { initializeRoomNotifications } = useNotification();
    const chatListAllUsers = useMemo(() => {
        if (!Array.isArray(initialUsers)) return [];
        const merged = [...initialUsers];
        (chatListActiveUsers || []).forEach(active => {
            if (!merged.find(u => ciEquals(u.email as string, active.email as string))) {
                merged.push(active);
            }
        });
        return merged;
    }, [initialUsers, chatListActiveUsers]);

    const prevConversationRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!conversationId) return;
        if (prevConversationRef.current === conversationId) return;
        prevConversationRef.current = conversationId;
        initializeRoomNotifications(conversationId);
    }, [conversationId, initializeRoomNotifications]);

    const isUserActive = (user: ChatUser) => {
        return chatListActiveUsers?.some(u => ciEquals(u.email as string, user.email as string));
    }

    const onlineUsers = chatListAllUsers?.filter(
        u => u.email?.toLowerCase() !== user?.email?.toLowerCase() && isUserActive(u)
    );

    const offlineUsers = chatListAllUsers?.filter(
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
                    onlineUsers.map((chatUser: ChatUser) => (
                        <UserRow key={`on-${chatUser.email}`} chatUser={chatUser} getLastMessages={getLastMessages} active={true} />
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
                    offlineUsers.map((chatUser: ChatUser) => (
                        <UserRow key={`off-${chatUser.email}`} chatUser={chatUser} getLastMessages={getLastMessages} active={false} />
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
}