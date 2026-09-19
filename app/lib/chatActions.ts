"use server"
import { env } from '@/app/config/env';
import { MAX_MESSAGE_LENGTH } from '@/app/config/limits';
import connectDB from "@/app/lib/MongoDb";
import mongoose, { Types } from "mongoose";
import ModerationService from '@/services/ModerationService';
import AccountRepository from "@/repositories/AccountRepository";
import MessageRepository from "@/repositories/MessageRepository";
import ConversationRepository from "@/repositories/ConversationRepository";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository";
import { extractUserIDFromCoockie, extractUsersEmailFromCoockie } from '@/app/lib/cookieActions';
import { IAccount } from "@/models/Account";
import MessageDTO from "@/types/messageDTO";
import { revalidatePath } from 'next/cache';
import RedisService from '@/services/RedisService';
import { sendNotification } from '@/app/lib/pushActions';
import { isTestBypass } from '@/app/lib/testBypass';

// Push notifications are sent from here (server-side, right after a message
// is persisted) rather than from the sender's browser - a push triggered
// client-side never fires if the sender closes the tab right after sending.
// "Offline" means the participant currently has no connected socket at all.
async function notifyOfflineParticipants(message: MessageDTO, messageDoc: any) {
    try {
        const participantIds = message.participantID || [];
        if (participantIds.length === 0) return;

        const participants = await AccountRepository.getUsersByID(participantIds);
        const offlineParticipantIds: string[] = [];
        for (const participant of participants) {
            const sockets = await RedisService.getUserSocketsByEmail(participant.email);
            if (sockets.length === 0) {
                offlineParticipantIds.push(participant._id.toString());
            }
        }

        if (offlineParticipantIds.length === 0) return;

        await sendNotification({
            ...message,
            sender: messageDoc.sender,
            conversationID: messageDoc.conversation?.toString(),
            participantID: offlineParticipantIds,
        });
    } catch (err) {
        console.error('Failed to send push notification:', err);
    }
}

export const getMessages = async (participantsId: string[], page: number) => {
    if (typeof page !== 'number' || page < 1) {
        return {
            success: false,
            message: 'Invalid page number',
            chat: [],
            conversation: null
        };
    }
    if (!Array.isArray(participantsId) || participantsId.some((id: string) => typeof id !== "string")) {
        return {
            success: false,
            message: 'Invalid participantsId',
            chat: [],
            conversation: null
        };
    }
    const messagesPerPage: number = env.NEXT_PUBLIC_MESSAGES_PER_PAGE;
    try {
        await connectDB();
        let chatQuery: any;
        let chat: any = [];
        let totalMessagesCount = 0;

        const userID = await extractUserIDFromCoockie();
        const partners = await AccountRepository.getUsersByID(participantsId);

        if (!userID || !partners) {
            return {
                success: false,
                message: 'Invalid participantsId',
                chat: [],
                conversation: null
            };
        }

        // Check for existing conversation between the users
        const conversation = await ConversationRepository.GetConversationByMembers([
            Types.ObjectId.createFromHexString(userID),
            ...partners.map((partner: IAccount) => new mongoose.Types.ObjectId(partner._id.toString()))
        ]);

        // If no conversation exists, return an empty response
        if (!conversation) {
            return {
                success: false,
                message: 'No conversation exists between the users',
                chat: [],
                conversation: null
            };
        }

        chatQuery = { conversation: conversation._id };

        if (conversation) {
            const cleanHistoryTime = await CleanHistoryRepository.findCleanHistory(
                Types.ObjectId.createFromHexString(userID),
                conversation._id
            );
            if (cleanHistoryTime) {
                chatQuery.date = { $gt: cleanHistoryTime.date }; // Filter messages after clean history time
            }
            totalMessagesCount = await MessageRepository.countMessages(chatQuery);
        }

        const skipCount: number = messagesPerPage * page;

        if (totalMessagesCount < skipCount) {
            if (skipCount - messagesPerPage < totalMessagesCount)
                chat = await MessageRepository.GetMessages(chatQuery, totalMessagesCount % messagesPerPage, 0);
            const result = JSON.parse(JSON.stringify({ success: true, message: 'All data fetched', chat, conversation: conversation._id }))
            return result;
        }

        chat = await MessageRepository.GetMessages(chatQuery, messagesPerPage, totalMessagesCount - messagesPerPage * page);
        const result = JSON.parse(JSON.stringify({ success: true, message: 'success', chat, conversation: conversation._id }))
        return result;

    } catch (err) {
        return {
            success: false,
            message: 'Failed to retrieve messages',
            chat: [],
            conversation: null
        };
    }
}

export const saveMessage = async (message: MessageDTO) => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            throw new Error('Unauthorized');
        }

        // The sender is always the authenticated caller, never whatever the
        // client claims - otherwise a user could persist a message under a
        // spoofed sender email even though the conversation membership is
        // correctly scoped to their own account.
        const senderEmail = await AccountRepository.getEmailById(new Types.ObjectId(userID));
        if (!senderEmail) {
            throw new Error('Unauthorized');
        }
        message = { ...message, sender: senderEmail };

        // Enforced here as well as on the inputs, because a server action is a
        // public endpoint - the client-side maxLength is a convenience, not a
        // limit.
        if (message.text && message.text.length > MAX_MESSAGE_LENGTH) {
            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                tooLong: true,
                message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`
            }));
        }

        if (!(await isTestBypass())) {
            // saveMessage was previously an unthrottled server action - 30
            // messages per minute is generous for real chat use but stops
            // flooding a conversation or hammering the DB/moderation API.
            const allowedToSend = await RedisService.checkRateLimit('send-message', userID, 30, 60);
            if (!allowedToSend) {
                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    rateLimited: true,
                    message: "You're sending messages too quickly. Please slow down and try again shortly."
                }));
            }
        }

        const banStatus = await ModerationService.isUserBanned(userID);
        if (banStatus.isBanned) {
            return JSON.parse(JSON.stringify({
                success: false,
                blocked: true,
                banned: true,
                reason: banStatus.reason,
                bannedUntil: banStatus.bannedUntil,
                message: banStatus.bannedUntil
                    ? `You are banned until ${banStatus.bannedUntil.toLocaleString()}`
                    : 'You are permanently banned from sending messages'
            }));
        }
        if (message.text) {
            const moderation = await ModerationService.moderateMessage(message.text);

            if (!moderation.isAllowed) {
                // Record violation and apply punishment
                const punishment = await ModerationService.recordViolation(
                    userID,
                    message.text,
                    moderation.reason || 'Inappropriate content',
                    moderation.categories || [],
                    moderation.severity || 'medium'
                );

                return JSON.parse(JSON.stringify({
                    success: false,
                    blocked: true,
                    punishment: punishment.action,
                    warningCount: punishment.warningCount,
                    bannedUntil: punishment.bannedUntil,
                    reason: moderation.reason,
                    message: punishment.message
                }));
            }
        }

        const messageDoc = await MessageRepository.SaveMessage(message, userID);

        // Fire-and-forget: don't make the sender wait on push delivery.
        void notifyOfflineParticipants(message, messageDoc);

        const result = JSON.parse(JSON.stringify({ success: true, messageDoc }));
        if (result) {
            revalidatePath('/chat');
            return result;
        }
    } catch (err) {
        console.error('Failed to save message:', err);
        const result = JSON.parse(JSON.stringify({ success: false, message: 'Failed to save message' }))
        return result;
    }
}

export const deleteMessage = async (id: string, type: string = "message") => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            throw new Error('Unauthorized');
        }
        const result = await MessageRepository.deleteMessage(id);
        if (result) {
            revalidatePath('/chat');
            return { success: true, message: "Message deleted" };
        }
        else
            return { success: false, message: "Failed to delete message" };
    } catch (err) {
        console.error('Failed to delete message:', err);
        const result = { success: false, message: 'Failed to delete message' };
        return result;
    }
}

export const getConversationMembers = async (conversationId: string) => {
    try {
        await connectDB();
        const requesterEmail = await extractUsersEmailFromCoockie();
        if (!requesterEmail) {
            return { success: false, members: [] };
        }
        const conversation = await ConversationRepository.GetConversationById(conversationId);
        if (!conversation) {
            return { success: false, members: [] };
        }
        // Only members of the conversation may see who else is in it -
        // conversation IDs are otherwise guessable/discoverable, and this
        // would leak the member list of any conversation to anyone logged in.
        const isRequesterMember = conversation.members?.some(
            (member: any) => member.email?.toLowerCase() === requesterEmail.toLowerCase()
        );
        if (!isRequesterMember) {
            return { success: false, members: [] };
        }
        const result = JSON.parse(JSON.stringify({
            success: true,
            members: conversation.members
        }));
        return result;
    } catch (err) {
        console.error('Failed to get conversation members:', err);
        return { success: false, members: [] };
    }
}

export const revalidateChatRoute = async () => {
    revalidatePath('/chat');
    return { success: true };
}

