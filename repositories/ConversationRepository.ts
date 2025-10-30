import Conversation from "../models/Conversation";
import { Types } from 'mongoose';
import Message from "../models/Message";
import FileModel from "../models/FileModel";

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

            const sortedConversations = conversations.sort((a, b) => {
                const aLastMessageDate = a.messages[0]?.date;
                const bLastMessageDate = b.messages[0]?.date;

                if (!aLastMessageDate) return 1;
                if (!bLastMessageDate) return -1;

                return new Date(bLastMessageDate).getTime() - new Date(aLastMessageDate).getTime();
            });

            return sortedConversations;
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