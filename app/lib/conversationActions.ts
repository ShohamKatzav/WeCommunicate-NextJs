"use server"
import connectDB from "@/app/lib/MongoDb";
import { Types } from "mongoose";
import ConversationRepository from "@/repositories/ConversationRepository";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository"
import { extractID } from '@/app/lib/cookieActions'
import { error } from "console";

export const getConversations = async () => {
    try {
        await connectDB();
        const userID = await extractID();
        const recentConversations = await ConversationRepository.GetRecentConversations(
            Types.ObjectId.createFromHexString(userID)
        );
        const result = JSON.parse(JSON.stringify({ success: true, recentConversations }))
        return result;

    } catch (err: any) {
        const result = JSON.parse(JSON.stringify({ error: 'Internal Server Error', status: 500 }))
        return result;
    }
}

export const cleanHistory = async (conversationId: string) => {
    if (!conversationId) throw error("Invalid Conversation Id")
    try {
        await connectDB();
        const userID = await extractID();
        await CleanHistoryRepository.updateCleanHistory(userID, conversationId);
        return { success: true };
    }
    catch (err) {
        console.error('Failed to clean history', err);
        const result = JSON.parse(JSON.stringify({ success: false, error: 'Failed to clean history' }))
        return result;
    }
}