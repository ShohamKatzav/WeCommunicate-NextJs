import Conversation from "../models/Conversation";
import { Types } from 'mongoose';
import Message from "../models/Message";
import FileModel from "../models/FileModel";
import CleanHistoryRepository from "./CleanHistoryRepository";

export default class ConversationRepository {

    static async GetConversationByMembers(members: Types.ObjectId[]) {
        try {
            const conversation = await Conversation.findOne({
                members: { $all: members },
                $expr: { $eq: [{ $size: "$members" }, members.length] }
            });

            return conversation;
        } catch (error) {
            console.error('Error finding conversation:', error);
            throw new Error('Unable to find conversation');
        }
    }
    static async GetRecentConversations(user: Types.ObjectId) {
        try {
            // Fetch all clean history records for this user once
            const cleanHistoryRecords = await CleanHistoryRepository.findAllForUser(user);
            const cleanHistoryMap = new Map(
                cleanHistoryRecords.map((record: any) => [
                    record.conversation.toString(),
                    record.date
                ])
            );

            const conversations = await Conversation.find({
                members: { $in: [user] },
            })
                .populate('members', 'email')
                .populate({
                    path: 'messages',
                    model: Message,
                    options: { sort: { date: -1 }, perDocumentLimit: 1 },
                    populate: {
                        path: 'file',
                        model: FileModel,
                        select: 'pathname',
                    },
                });

            // Filter conversations based on clean history
            const filteredConversations = conversations
                .map(conv => {
                    const cleanTime = cleanHistoryMap.get(conv._id.toString());

                    // Filter messages after clean history time
                    if (cleanTime && conv.messages.length > 0) {
                        conv.messages = conv.messages.filter(
                            (msg: any) => new Date(msg.date) > new Date(cleanTime)
                        );
                    }

                    return conv;
                });

            // Sort by last message date
            return filteredConversations.sort((a, b) => {
                const aDate = a.messages[0]?.date;
                const bDate = b.messages[0]?.date;
                if (!aDate) return 1;
                if (!bDate) return -1;
                return new Date(bDate).getTime() - new Date(aDate).getTime();
            });
        } catch (error) {
            console.error('Error finding conversations:', error);
            throw new Error('Unable to find conversations');
        }
    }
    static async CreateConversation(members: Types.ObjectId[]) {
        try {
            return await Conversation.create({ members });
        } catch (err) {
            console.error('Failed to create conversation:', err);
            throw err;
        }
    }
}