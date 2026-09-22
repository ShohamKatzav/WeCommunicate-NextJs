"use server"
import connectDB from "@/app/lib/MongoDb";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository"
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions'
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import ConversationRepository from "@/repositories/ConversationRepository";
import { DISAPPEARING_MESSAGES_OPTIONS } from "@/app/config/limits";

const applyCleanHistory = async (conversationId: string, cutoff: number) => {
    if (!conversationId) throw new Error("Invalid Conversation Id")
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();

        const result = await CleanHistoryRepository.updateCleanHistory(userID, conversationId, cutoff);
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

// `clearedAt` only ever rides along so the service worker can pick it out of
// this action's marshalled request body and queue it when offline (see
// isCleanHistory in public/service-worker.js) - this live/online path always
// writes server time, exactly like before that argument existed. Only the
// queued replay (app/api/cleanhistory/route.ts, via applyCleanHistory above)
// ever applies a client-supplied cutoff.
export const cleanHistory = async (conversationId: string, type: string = "cleanHistory", clearedAt?: string) => {
    return applyCleanHistory(conversationId, Date.now());
}

export const cleanHistoryReplay = async (conversationId: string, cutoff: number) => {
    return applyCleanHistory(conversationId, cutoff);
}

export const getDisappearingMessagesSetting = async (conversationId: string) => {
    if (!conversationId) return { success: false, seconds: 0 };
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        const conversation = await ConversationRepository.GetConversationById(conversationId);
        if (!conversation) return { success: false, seconds: 0 };

        const isMember = conversation.members?.some(
            (member: any) => member._id?.toString() === userID
        );
        if (!isMember) return { success: false, seconds: 0 };

        return { success: true, seconds: conversation.disappearingMessagesSeconds || 0 };
    } catch (err) {
        console.error('Failed to get disappearing messages setting:', err);
        return { success: false, seconds: 0 };
    }
}

export const setDisappearingMessages = async (conversationId: string, seconds: number) => {
    if (!conversationId) throw new Error("Invalid Conversation Id");
    // Only ever one of the offered durations - never an arbitrary
    // client-supplied number of seconds.
    if (!DISAPPEARING_MESSAGES_OPTIONS.some(option => option.seconds === seconds)) {
        return { success: false, error: 'Invalid duration' };
    }
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, error: 'Unauthorized' };
        }

        const result = await ConversationRepository.SetDisappearingMessages(
            conversationId,
            new Types.ObjectId(userID),
            seconds
        );

        // matchedCount === 0 means either the conversation doesn't exist or
        // the caller isn't a member of it (see SetDisappearingMessages'
        // membership filter) - either way, nothing was changed.
        if (result.matchedCount === 0) {
            return { success: false, error: 'Not a member of this conversation' };
        }

        revalidatePath('/chat');
        return { success: true };
    } catch (err) {
        console.error('Failed to set disappearing messages:', err);
        return { success: false, error: 'Failed to update setting' };
    }
}

export const deleteConversation = async (conversationId: string, type: string = "conversation") => {
    if (!conversationId) throw new Error("Invalid Conversation Id")
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();

        await CleanHistoryRepository.updateCleanHistory(userID, conversationId);
        const result = await ConversationRepository.DeleteConversation(userID, conversationId);

        // Ensure write is committed (if using MongoDB, check writeConcern)
        if (result.acknowledged) {
            revalidatePath('/chat');
            return { success: true };
        }

        return { success: false, error: 'Write not acknowledged' };
    }
    catch (err) {
        console.error('Failed to delete conversation', err);
        return { success: false, error: 'Failed to delete conversation' };
    }
}