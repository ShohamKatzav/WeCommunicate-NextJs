"use server"
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import { extractUserIDFromCoockie } from "@/app/lib/cookieActions";
import { revalidatePath } from "next/cache";

export const getBlockedUserIds = async () => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, blockedIds: [] };

        const blockedIds = await AccountRepository.getBlockedIds(userID);
        return { success: true, blockedIds };
    } catch (err) {
        console.error('Failed to get blocked users:', err);
        return { success: false, blockedIds: [] };
    }
}

export const blockUser = async (targetUserID: string) => {
    if (!targetUserID) return { success: false, error: 'Invalid user' };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };
        if (userID === targetUserID) return { success: false, error: "You can't block yourself" };

        await AccountRepository.blockUser(userID, targetUserID);
        revalidatePath('/chat');
        return { success: true };
    } catch (err) {
        console.error('Failed to block user:', err);
        return { success: false, error: 'Failed to block user' };
    }
}

export const unblockUser = async (targetUserID: string) => {
    if (!targetUserID) return { success: false, error: 'Invalid user' };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: 'Unauthorized' };

        await AccountRepository.unblockUser(userID, targetUserID);
        revalidatePath('/chat');
        return { success: true };
    } catch (err) {
        console.error('Failed to unblock user:', err);
        return { success: false, error: 'Failed to unblock user' };
    }
}
