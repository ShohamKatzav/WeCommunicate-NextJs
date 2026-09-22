"use client"
import { useEffect, useMemo, useRef } from "react";
import { useUser } from "../hooks/useUser";
import { useNotification } from "../hooks/useNotification";
import ChatUser from "@/types/chatUser";
import ciEquals from "../utils/ciEqual";
import UserRow from "./userRow";
import { Users } from 'lucide-react';
import useIsMobile from "../hooks/useIsMobile";

interface UsersListClientProps {
    initialUsers: ChatUser[];
    chatListActiveUsers: ChatUser[];
    getLastMessages: (participantFromList: ChatUser[]) => Promise<void>;
    conversationId?: string | undefined;
    isMobileUsersSidebarOpen: boolean;
    blockedUserIds: string[];
    onToggleBlock: (targetUserId: string, shouldBlock: boolean) => Promise<void>;
    lastSeenByEmail: Record<string, string>;
}

export default function UsersListClient({
    initialUsers,
    chatListActiveUsers,
    getLastMessages,
    conversationId,
    isMobileUsersSidebarOpen,
    blockedUserIds,
    onToggleBlock,
    lastSeenByEmail,
}: UsersListClientProps) {

    const { user } = useUser();
    const { initializeRoomNotifications } = useNotification();
    const isMobile = useIsMobile();

    const chatListAllUsers = useMemo(() => {
        if (!Array.isArray(initialUsers)) return [];
        const merged = [...initialUsers];
        (chatListActiveUsers || []).forEach(active => {
            const alreadyListed = merged.some(u =>
                u._id && active._id ? u._id === active._id : ciEquals(u.email, active.email)
            );
            if (!alreadyListed) {
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


    // On mobile only
    // When the component mount we'll define the --app-inner-height CSS variable which holds the viewport height
    // When rendering the users list scroll we'll substract 20vh from it as doing the parent component which creating space for the footer and navbar
    useEffect(() => {
        if (!isMobile) return;
        const setVh = () =>
            document.documentElement.style.setProperty("--app-inner-height", "100dvh");

        setVh();
        window.addEventListener("resize", setVh);
        return () => window.removeEventListener("resize", setVh);
    }, []);

    // A user who has gone offline since this page loaded has a fresher
    // timestamp on the socket than the one the row was rendered with.
    const lastSeenFor = (chatUser: ChatUser) =>
        (chatUser.email ? lastSeenByEmail[chatUser.email.toLowerCase()] : undefined) ?? chatUser.lastSeen;

    const isUserActive = (user: ChatUser) => {
        return chatListActiveUsers?.some(u =>
            user._id && u._id ? user._id === u._id : ciEquals(u.email, user.email)
        );
    }

    // Only treat two rows as the same person when both actually have an email.
    // A missing email used to compare equal to another missing email and hide
    // every account that doesn't have one.
    const isViewer = (email?: string) =>
        Boolean(user?.email) && Boolean(email) && email!.toLowerCase() === user!.email!.toLowerCase();

    const onlineUsers = chatListAllUsers?.filter(
        u => !isViewer(u.email) && isUserActive(u)
    );

    const offlineUsers = chatListAllUsers?.filter(
        u => !isViewer(u.email) && !isUserActive(u)
    );

    return (
        <div className={`
                ${isMobileUsersSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                xl:translate-x-0 fixed xl:relative right-0 z-20
                w-80 xl:w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
                transition-transform duration-300 ease-in-out h-full flex flex-col shadow-xl
            `}>
            <aside className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg transition-transform duration-300`}>
                <div className="flex-1 overflow-y-auto touch-pan-y max-h-[calc(var(--app-inner-height,100vh)-20vh)] xl:max-h-none">
                    <div className="px-3 py-2 text-xs text-success font-semibold">
                        Active now
                    </div>
                    {onlineUsers.length > 0 ?
                        onlineUsers.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")).map((chatUser: ChatUser) => (
                            <UserRow
                                key={`on-${chatUser._id || chatUser.email}`}
                                chatUser={chatUser}
                                getLastMessages={getLastMessages}
                                active={true}
                                isBlocked={blockedUserIds.includes(chatUser._id)}
                                onToggleBlock={onToggleBlock}
                            />
                        ))
                        :
                        <div className="text-center text-muted-foreground py-8">
                            <Users size={32} className="mx-auto pb-2 opacity-50" />
                            <p className="text-sm">No active users</p>
                        </div>
                    }

                    <div className="px-3 py-2 text-xs text-muted-foreground font-semibold mt-3">
                        Others
                    </div>
                    {offlineUsers.length > 0 ?
                        offlineUsers.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")).map((chatUser: ChatUser) => (
                            <UserRow
                                key={`off-${chatUser._id || chatUser.email}`}
                                chatUser={chatUser}
                                getLastMessages={getLastMessages}
                                active={false}
                                isBlocked={blockedUserIds.includes(chatUser._id)}
                                onToggleBlock={onToggleBlock}
                                lastSeen={lastSeenFor(chatUser)}
                            />
                        ))
                        :
                        <div className="text-center text-muted-foreground py-8">
                            <Users size={32} className="mx-auto pb-2 opacity-50" />
                            <p className="text-sm">No inactive users</p>
                        </div>
                    }
                </div>
            </aside>
        </div >
    );
}
