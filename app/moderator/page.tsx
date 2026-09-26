"use client";
import { useEffect, useRef, useState } from 'react';
import { useUser } from '../hooks/useUser';
import { useRouter } from 'next/navigation';
import { getAllUsers, banUser, unbanUser, promoteToModerator, demoteFromModerator } from '../lib/moderatorActions';
import { Shield, Ban, CheckCircle, UserX, UserCheck, ShieldOff, ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../components/ui/loading';
import { useSocket } from '../hooks/useSocket';
import { useT } from '../i18n/client';
import { pageTitleClassName } from '../components/shell/pageTitle';
import PageTitle from '../components/shell/fitTitle';
import type { TFunction } from '../i18n/messages';

function sessionUserId(token?: string): string | null {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { _id?: unknown };
        return typeof decoded._id === 'string' ? decoded._id : null;
    } catch {
        return null;
    }
}

interface UserStatus {
    _id: string;
    email?: string;
    nickname?: string;
    phone?: string;
    isModerator: boolean;
    isBanned: boolean;
    banReason: string;
}

function accountLabel(userItem: UserStatus, t: TFunction): string {
    if (userItem.email) {
        return userItem.email.charAt(0).toUpperCase() + userItem.email.slice(1);
    }
    const nickname = userItem.nickname?.trim();
    if (nickname) return nickname;
    const phone = userItem.phone?.trim();
    if (phone) return phone;
    return t("moderator.unknownUser");
}

// The moderation service's English prefix on a stored reason (see
// ModerationService.moderateMessage) - stripped for display.
const FLAGGED_PREFIX = "Content flagged for: ";

// Long enough to scan a page, short enough that the actions stay on screen.
const USERS_PER_PAGE = 10;

export default function ModeratorPanel() {
    const { user, loadingUser } = useUser();
    const t = useT();
    const { socket } = useSocket();
    const router = useRouter();
    const [users, setUsers] = useState<UserStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const tableRef = useRef<HTMLDivElement>(null);

    const loadUsers = async () => {
        const result = await getAllUsers();
        if (result.success) {
            const usersWithCleanReasons = result.users.map((user: UserStatus) => ({
                ...user,
                banReason: user.banReason?.split(FLAGGED_PREFIX)[1] || user.banReason
            }));
            setUsers(usersWithCleanReasons);
        } else {
            toast.error(result.message);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        await loadUsers();
        setLoading(false);
    };

    // Same data, without the full-page spinner - for a live update.
    const refreshUsers = () => loadUsers();

    useEffect(() => {
        if (!loadingUser && !user?.isModerator) {
            router.push('/chat');
        }
    }, [user, loadingUser, router]);

    useEffect(() => {
        if (user?.isModerator) {
            fetchUsers();
        }
    }, [user]);

    const handleUserBanned = (data: { userEmail: string, message: string }, isBannedUpdate: boolean) => {
        const { userEmail, message } = data;
        const parsedReason = message?.split(FLAGGED_PREFIX)[1];
        // The banned user's own client words this message, in their language,
        // so the English prefix is only there when that language is English.
        // Otherwise read the reason stored on the account instead.
        if (isBannedUpdate && message && !parsedReason) {
            void refreshUsers();
            return;
        }
        updateUserRowByEmail(userEmail, { isBanned: isBannedUpdate, banReason: parsedReason || t("moderator.bannedByModerator") });
    }

    const handleBanExpired = (userEmails: string[]) => {
        for (const email of userEmails)
            updateUserRowByEmail(email, { isBanned: false });
    }

    useEffect(() => {
        if (!socket || !user?.isModerator) return;

        // These must be the exact same function references passed to both
        // .on() and .off() - the previous code registered inline arrows but
        // tried to remove them with a different (bare) reference, which is a
        // silent no-op, so listeners piled up on every reconnect.
        const onBanned = (data: { userEmail: string, message: string }) => handleUserBanned(data, true);
        const onUnbanned = (data: { userEmail: string, message: string }) => handleUserBanned(data, false);
        const onBanExpire = (data: { userEmails: string[] }) => handleBanExpired(data.userEmails);

        socket.on("moderator_update_banned_user", onBanned);
        socket.on("moderator_update_unbanned_user", onUnbanned);
        socket.on("update_ban_expire", onBanExpire);
        return () => {
            socket.off("moderator_update_banned_user", onBanned);
            socket.off("moderator_update_unbanned_user", onUnbanned);
            socket.off("update_ban_expire", onBanExpire);
        };
    }, [socket, user?.isModerator]);

    const handleBan = async (userId: string) => {
        const result = await banUser(userId);
        if (result.success) {
            toast.success(result.message);
            if (socket && result.userEmail) {
                socket.emit('ban user', { userEmail: result.userEmail });
            }
            updateUserRow(userId, { isBanned: true });
        } else {
            toast.error(result.message);
        }
    };

    const handleUnban = async (userId: string) => {
        const result = await unbanUser(userId);
        if (result.success) {
            toast.success(result.message);
            if (socket && result.userEmail) {
                socket.emit('unban user', { userEmail: result.userEmail });
            }
            updateUserRow(userId, { isBanned: false });
        } else {
            toast.error(result.message);
        }
    };

    const handleDemote = async (userId: string) => {
        const result = await demoteFromModerator(userId);
        if (result.success) {
            toast.success(result.message);
            // Their open tabs re-read the account and drop the Moderator link.
            if (socket && result.userEmail) {
                socket.emit('moderator status changed', { userEmail: result.userEmail });
            }
            updateUserRow(userId, { isModerator: false });
        } else {
            toast.error(result.message);
        }
    };

    const handlePromote = async (userId: string) => {
        const result = await promoteToModerator(userId);
        if (result.success) {
            toast.success(result.message);
            if (socket && result.userEmail) {
                socket.emit('moderator status changed', { userEmail: result.userEmail });
            }
            updateUserRow(userId, { isModerator: true });
        } else {
            toast.error(result.message);
        }
    };

    const currentUserId = sessionUserId(user?.token);
    const isSelf = (userItem: UserStatus) =>
        (currentUserId != null && userItem._id === currentUserId) ||
        (Boolean(userItem.email) && userItem.email!.toLowerCase() === user?.email?.toLowerCase());

    const filteredUsers = users.filter(u => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const haystack = [u.email, u.nickname, u.phone].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(query);
    });

    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
    const currentPage = Math.min(page, pageCount);
    const pageStart = (currentPage - 1) * USERS_PER_PAGE;
    const pageUsers = filteredUsers.slice(pageStart, pageStart + USERS_PER_PAGE);

    const showPage = (next: number) => {
        setPage(next);
        // The bar is fixed, so a plain scroll would tuck the new rows under it.
        tableRef.current?.scrollIntoView({ block: "start" });
    };

    const updateUserRow = (userId: string, patch: Partial<UserStatus>) => {
        setUsers(prev =>
            prev.map(u => u._id === userId ? { ...u, ...patch } : u)
        );
    };

    const updateUserRowByEmail = (email: string, patch: Partial<UserStatus>) => {
        const target = email?.toLowerCase();
        if (!target) return;
        setUsers(prev =>
            prev.map(u => u.email?.toLowerCase() === target ? { ...u, ...patch } : u)
        );
    };

    if (loadingUser || loading) {
        return (
            <Loading />
        );
    }

    if (!user?.isModerator) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
            <div className="mb-8 text-center">
                <PageTitle className={`${pageTitleClassName} mb-4`}>
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-700 to-rose-700 dark:from-amber-300 dark:to-rose-400">{t("moderator.title")}</span>
                </PageTitle>
                <p className="mx-auto max-w-2xl text-muted-foreground">
                    {t("moderator.subtitle")}
                </p>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder={t("moderator.search")}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <div ref={tableRef} className="scroll-mt-[calc(var(--content-top-offset)+0.75rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t("moderator.user")}
                                </th>
                                <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t("moderator.status")}
                                </th>
                                <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t("moderator.banReason")}
                                </th>
                                <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t("moderator.role")}
                                </th>
                                <th className="px-6 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {t("moderator.actions")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {pageUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                                        {t("moderator.empty")}
                                    </td>
                                </tr>
                            ) : pageUsers.map((userItem) => (
                                <tr key={userItem._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        <bdi dir="auto">{accountLabel(userItem, t)}</bdi>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {userItem.isBanned ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                <Ban className="w-3 h-3 me-1" />
                                                {t("moderator.banned")}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                <CheckCircle className="w-3 h-3 me-1" />
                                                {t("moderator.active")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {userItem.isBanned && userItem.banReason && (
                                            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium 
                                                            bg-amber-100 text-amber-800 
                                                            dark:bg-amber-900 dark:text-amber-200 inline-block max-w-sm truncate" title={userItem.banReason}>
                                                {userItem.banReason}
                                            </span>
                                        )
                                        }
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {userItem.isModerator && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                <Shield className="w-3 h-3 me-1" />
                                                {t("moderator.moderator")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {userItem.isBanned ? (
                                                <button
                                                    key="unban"
                                                    onClick={() => handleUnban(userItem._id)}
                                                    // Same inversion the status badges already use (light bg/dark
                                                    // text <-> dark bg/light text), not just a darker shade of the
                                                    // same fill - a one-step 700->800 read as identical at a
                                                    // glance. green-400/green-950 is 8.6:1 (computed), well past
                                                    // the 4.5:1 AA minimum for text.
                                                    className="inline-flex items-center px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white dark:bg-green-400 dark:hover:bg-green-300 dark:text-green-950 rounded-lg transition-colors"
                                                >
                                                    <UserCheck className="w-4 h-4 me-1" />
                                                    {t("moderator.unban")}
                                                </button>
                                            ) : !isSelf(userItem) && (
                                                <button
                                                    key="ban"
                                                    onClick={() => handleBan(userItem._id)}
                                                    disabled={isSelf(userItem)}
                                                    // red-400/red-950 is 5.8:1 (computed).
                                                    className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white dark:bg-red-400 dark:hover:bg-red-300 dark:text-red-950 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <UserX className="w-4 h-4 me-1" />
                                                    {t("moderator.ban")}
                                                </button>
                                            )}

                                            {userItem.isModerator && !isSelf(userItem) ? (
                                                <button
                                                    key="demote"
                                                    onClick={() => handleDemote(userItem._id)}
                                                    // Same inversion as Unban above - amber-400/amber-950 is 9.0:1.
                                                    className="inline-flex items-center px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-amber-950 rounded-lg transition-colors"
                                                >
                                                    <ShieldOff className="w-4 h-4 me-1" />
                                                    {t("moderator.demote")}
                                                </button>
                                            ) : (
                                                !userItem.isBanned && !isSelf(userItem) && (
                                                    <button
                                                        key="promote"
                                                        onClick={() => handlePromote(userItem._id)}
                                                        // Same inversion as Unban above - indigo-400/indigo-950 is 5.4:1.
                                                        className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-400 dark:hover:bg-indigo-300 dark:text-indigo-950 rounded-lg transition-colors"
                                                    >
                                                        <ShieldPlus className="w-4 h-4 me-1" />
                                                        {t("moderator.promote")}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {pageCount > 1 && (
                    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {t("moderator.range", {
                                start: pageStart + 1,
                                end: pageStart + pageUsers.length,
                                total: filteredUsers.length,
                            })}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => showPage(currentPage - 1)}
                                disabled={currentPage <= 1}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                {t("moderator.previous")}
                            </button>
                            <button
                                type="button"
                                onClick={() => showPage(currentPage + 1)}
                                disabled={currentPage >= pageCount}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                {t("moderator.next")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}