"use server"
import connectDB from "@/app/lib/MongoDb";
import mongoose, { Types } from "mongoose";
import AccountRepository from "@/repositories/AccountRepository";
import MessageRepository from "@/repositories/MessageRepository"
import ConversationRepository from "@/repositories/ConversationRepository";
import CleanHistoryRepository from "@/repositories/CleanHistoryRepository"
import { extractUserIDFromCoockie } from '@/app/lib/cookieActions'
import { IAccount } from "@/models/Account";
import MessageDTO from "@/types/messageDTO";

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
    const messagesPerPage = parseInt(process.env.MESSAGES_PER_PAGE || '5');
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
        const messageDoc = await MessageRepository.SaveMessage(message, userID);
        const result = JSON.parse(JSON.stringify({ success: true, messageDoc }));
        return result;
    } catch (err) {
        console.error('Failed to save message:', err);
        const result = JSON.parse(JSON.stringify({ success: false, message: 'Failed to save message' }))
        return result;
    }
}

export const deleteMessage = async (id: string) => {
    try {
        await connectDB();
        const userID = await extractUserIDFromCoockie();
        if (typeof userID !== 'string') {
            throw new Error('Unauthorized');
        }
        const result = await MessageRepository.deleteMessage(id);
        if (result)
            return { success: true, message: "Message deleted" };
        else
            return { success: false, message: "Failed to delete message" };
    } catch (err) {
        console.error('Failed to delete message:', err);
        const result = { success: false, message: 'Failed to delete message' };
        return result;
    }
}

