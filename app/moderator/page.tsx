"use client";
import { useEffect, useState } from 'react';
import { useUser } from '../hooks/useUser';
import { useRouter } from 'next/navigation';
import { getAllUsers, banUser, unbanUser, promoteToModerator, demoteFromModerator } from '../lib/moderatorActions';
import { Shield, Ban, CheckCircle, UserX, UserCheck, ShieldOff, ShieldPlus } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../components/loading';
import { useSocket } from '../hooks/useSocket';

interface UserStatus {
    _id: string;
    email: string;
    isModerator: boolean;
    isBanned: boolean;
}

export default function ModeratorPanel() {
    const { user, loadingUser } = useUser();
    const { socket } = useSocket();
    const router = useRouter();
    const [users, setUsers] = useState<UserStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

    const fetchUsers = async () => {
        setLoading(true);
        const result = await getAllUsers();
        if (result.success) {
            setUsers(result.users);
        } else {
            toast.error(result.message);
        }
        setLoading(false);
    };

    const handleBan = async (email: string) => {
        const result = await banUser(email);
        if (result.success) {
            toast.success(result.message);
            if (socket && result.userEmail) {
                socket.emit('ban user', { userEmail: result.userEmail });
            }
            updateUserRow(email, { isBanned: true });
        } else {
            toast.error(result.message);
        }
    };

    const handleUnban = async (email: string) => {
        const result = await unbanUser(email);
        if (result.success) {
            toast.success(result.message);
            if (socket && result.userEmail) {
                socket.emit('unban user', { userEmail: result.userEmail });
            }
            updateUserRow(email, { isBanned: false });
        } else {
            toast.error(result.message);
        }
    };

    const handleDemote = async (email: string) => {
        const result = await demoteFromModerator(email);
        if (result.success) {
            toast.success(result.message);
            updateUserRow(email, { isModerator: false });
        } else {
            toast.error(result.message);
        }
    };

    const handlePromote = async (email: string) => {
        const result = await promoteToModerator(email);
        if (result.success) {
            toast.success(result.message);
            updateUserRow(email, { isModerator: true });
        } else {
            toast.error(result.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const updateUserRow = (email: string, patch: Partial<UserStatus>) => {
        setUsers(prev =>
            prev.map(u =>
                u.email === email ? { ...u, ...patch } : u
            )
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-8 h-8 text-blue-600" />
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                        Moderator Panel
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage user accounts and permissions
                </p>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search users by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.map((userItem) => (
                                <tr key={userItem._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {userItem.email.slice(0, 1).toUpperCase() + userItem.email.slice(1)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {userItem.isBanned ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                <Ban className="w-3 h-3 mr-1" />
                                                Banned
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {userItem.isModerator && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                <Shield className="w-3 h-3 mr-1" />
                                                Moderator
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {userItem.isBanned ? (
                                                <button
                                                    onClick={() => handleUnban(userItem.email)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                                >
                                                    <UserCheck className="w-4 h-4 mr-1" />
                                                    Unban
                                                </button>
                                            ) : userItem.email.toLowerCase() !== user.email?.toLowerCase() && (
                                                <button
                                                    onClick={() => handleBan(userItem.email)}
                                                    disabled={userItem.email === user.email}
                                                    className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <UserX className="w-4 h-4 mr-1" />
                                                    Ban
                                                </button>
                                            )}

                                            {userItem.isModerator && userItem.email.toLowerCase() !== user.email?.toLowerCase() ? (
                                                <button
                                                    onClick={() => handleDemote(userItem.email)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                                                >
                                                    <ShieldOff className="w-4 h-4 mr-1" />
                                                    Demote
                                                </button>
                                            ) : (
                                                !userItem.isBanned && userItem.email.toLowerCase() !== user.email?.toLowerCase() && (
                                                    <button
                                                        onClick={() => handlePromote(userItem.email)}
                                                        className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                                                    >
                                                        <ShieldPlus className="w-4 h-4 mr-1" />
                                                        Promote
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
            </div>
        </div>
    );
}