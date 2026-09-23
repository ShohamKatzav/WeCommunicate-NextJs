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

// A brand-new chat (never sent a message) has no Conversation document yet -
// MessageRepository.SaveMessage creates one lazily on first send via the
// same GetOrCreateConversationByMembers call below. Features that need a
// real conversation id before that first message exists (starting a call,
// setting disappearing messages) call this to create it on demand instead.
// Trusts participantIds the same way SaveMessage already does: any
// authenticated user can open a conversation with any other account id,
// which is the existing model for starting a chat at all.
export const getOrCreateConversationId = async (participantIds: string[]) => {
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return { success: false, error: 'Invalid participants' };
    }
    if (!participantIds.every(id => Types.ObjectId.isValid(id))) {
        return { success: false, error: 'Invalid participants' };
    }
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, error: 'Unauthorized' };
        }

        const memberIDs = [
            new Types.ObjectId(userID),
            ...participantIds.map(id => new Types.ObjectId(id))
        ];
        const conversation = await ConversationRepository.GetOrCreateConversationByMembers(memberIDs);

        revalidatePath('/chat');
        return { success: true, conversationId: conversation._id.toString() };
    } catch (err) {
        console.error('Failed to get or create conversation:', err);
        return { success: false, error: 'Failed to open conversation' };
    }
}

// Opening a chat that isn't in the caller's list - typically one they
// deleted, which only hides it for them - must still land in the real
// conversation, or its room never gets joined and the other person's typing,
// live messages and read receipts don't arrive until the caller sends
// something. Read-only: a pair that has never talked stays without a
// Conversation document until the first message (or a call / setting) needs
// one, same as before.
export const findConversationId = async (participantIds: string[]) => {
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return { success: false, conversationId: null };
    }
    if (!participantIds.every(id => Types.ObjectId.isValid(id))) {
        return { success: false, conversationId: null };
    }
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            return { success: false, conversationId: null };
        }

        const conversationId = await ConversationRepository.FindConversationIdByMembers([
            new Types.ObjectId(userID),
            ...participantIds.map(id => new Types.ObjectId(id))
        ]);
        return { success: true, conversationId };
    } catch (err) {
        console.error('Failed to find conversation:', err);
        return { success: false, conversationId: null };
    }
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