"use server"
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions';
import RedisService from '@/services/RedisService';
import FileDTO from '@/types/FileDTO';

interface SharedContent {
    userID: string;
    text?: string;
    file?: FileDTO;
}

export const getSharedContent = async (token: string) => {
    if (!token) return { success: false };
    try {
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') return { success: false };

        const content = await RedisService.popSharedContent<SharedContent>(token);
        // Only the account that shared it may consume it - a token is a
        // single-use random UUID, but there's no reason another logged-in
        // user's guess (or a leaked URL) should ever return someone else's
        // shared content.
        if (!content || content.userID !== userID) return { success: false };

        return { success: true, text: content.text, file: content.file };
    } catch (err) {
        console.error('Failed to retrieve shared content:', err);
        return { success: false };
    }
};
