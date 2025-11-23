"use server"
import connectDB from "@/app/lib/MongoDb";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository"
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions'
import { revalidatePath } from "next/cache";

export const cleanHistory = async (conversationId: string) => {
    if (!conversationId) throw new Error("Invalid Conversation Id")
    try {
        const db = await connectDB();
        const userID = await extractUserIDFromCoockie();

        // Wait for write to be acknowledged
        const result = await CleanHistoryRepository.updateCleanHistory(userID, conversationId);

        // Ensure write is committed (if using MongoDB, check writeConcern)
        if (result.acknowledged) {
            revalidatePath('/chat');
            return { success: true };
        }

        return { success: false, error: 'Write not acknowledged' };
    }
    catch (err) {
        console.error('Failed to clean history', err);
        return { success: false, error: 'Failed to clean history' };
    }
}