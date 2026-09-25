"use server"
import connectDB from "@/app/lib/MongoDb";
import AccountRepository from "@/repositories/AccountRepository";
import { extractUserIDFromCoockie } from "@/app/lib/cookieActions";
import { revalidatePath } from "next/cache";
import { getT } from "@/app/i18n/server";

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
    const t = await getT();
    if (!targetUserID) return { success: false, error: t('errors.invalidUser') };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: t('errors.unauthorized') };
        if (userID === targetUserID) return { success: false, error: t('errors.cantBlockSelf') };

        await AccountRepository.blockUser(userID, targetUserID);
        revalidatePath('/chat');
        return { success: true };
    } catch (err) {
        console.error('Failed to block user:', err);
        return { success: false, error: t('errors.blockFailed') };
    }
}

export const unblockUser = async (targetUserID: string) => {
    const t = await getT();
    if (!targetUserID) return { success: false, error: t('errors.invalidUser') };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false, error: t('errors.unauthorized') };

        await AccountRepository.unblockUser(userID, targetUserID);
        revalidatePath('/chat');
        return { success: true };
    } catch (err) {
        console.error('Failed to unblock user:', err);
        return { success: false, error: t('errors.unblockFailed') };
    }
}
