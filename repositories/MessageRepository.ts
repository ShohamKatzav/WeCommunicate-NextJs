import Message from "../models/Message";
import FileModel from "../models/FileModel";
import ConversationRepository from "./ConversationRepository";
import { Schema, Types } from 'mongoose';
import MessageDTO from '@/app/types/messageDTO';

type ChatQuery = {
    date?: {
        $gt?: any;
    };
    conversation: Schema.Types.ObjectId; // Ensure query includes conversation
};

export default class MessageRepository {
    static async GetMessages(query: ChatQuery, limit: number, skip: number) {
        try {
            return await Message.find(query)
                .skip(skip)
                .limit(limit)
                .populate("file") // gets url, contentType, etc.
                .lean() // return plain JS objects (faster for read-only)
                .exec();
        } catch (err) {
            console.error('Failed to find messages:', err);
            throw err;
        }
    }

    static async SaveMessage(data: MessageDTO, userID: string) {
        try {
            const { date, sender, participantID, text, file } = data;
            const participantIDArray = Array.isArray(participantID) ? participantID : [];

            const memberIDs = [
                new Types.ObjectId(userID),
                ...participantIDArray.map(id => new Types.ObjectId(id))
            ];

            let conversation = await ConversationRepository.GetConversationByMembers(memberIDs);

            if (!conversation) {
                conversation = await ConversationRepository.CreateConversation(
                    memberIDs);
            }
            let newFileId;
            if (file) {
                const newFile = await FileModel.create({
                    contentType: file.contentType,
                    url: file.url,
                    downloadUrl: file.downloadUrl,
                    pathname: file.pathname
                });
                newFileId = newFile._id;
            }
            const newMessage = await Message.create({
                date,
                sender,
                text,
                file: newFileId,
                conversation: conversation._id
            });

            conversation.messages.push(newMessage._id);
            await conversation.save();

            return newMessage;
        } catch (err) {
            console.error('Failed to save message:', err);
            throw err;
        }
    }

    static async countMessages(query: ChatQuery) {
        try {
            return await Message.countDocuments(query);
        } catch (err) {
            console.error('Failed to count messages:', err);
            throw err;
        }
    }
}