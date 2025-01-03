import Message from "../models/Message";
import ConversationRepository from "./ConversationDal";
import { Schema, Types } from 'mongoose';

interface MessageDTO {
    date: Number;
    sender: string;
    participantID: string[];
    value: string;
}

type ChatQuery = {
    date?: {
        $gt?: any;
    };
    conversation: Schema.Types.ObjectId; // Ensure query includes conversation
};

export default class MessageRepository {
    static async GetMessages(query: ChatQuery, limit: number, skip: number) {
        try {
            return await Message.find(query).skip(skip).limit(limit).exec();
        } catch (err) {
            console.error('Failed to find messages:', err);
            throw err;
        }
    }

    static async SaveMessage(data: MessageDTO, userID: string) {
        try {
            const { date, sender, participantID, value } = data;
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

            const newMessage = await Message.create({
                date,
                sender,
                value,
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