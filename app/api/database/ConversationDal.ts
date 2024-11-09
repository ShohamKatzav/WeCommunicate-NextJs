import Conversation from "../models/Conversation";
import { Schema, Types } from 'mongoose';

export default class ConversationRepository {

    static async GetConversation(members: Types.ObjectId[]) {
        try {
            const conversation = await Conversation.findOne({
                members: { $all: members },
            });
            
            return conversation;
        } catch (error) {
            console.error('Error finding conversation:', error);
            throw new Error('Unable to find conversation');
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