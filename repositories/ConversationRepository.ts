import Conversation from "../models/Conversation";
import { Types } from 'mongoose';
import Message from "../models/Message";
import FileModel from "../models/FileModel";
import CleanHistoryRepository from "./CleanHistoryRepository";

export default class ConversationRepository {

    static async GetConversationById(conversationId: string) {
        try {
            const conversation = await Conversation.findOne({ _id: conversationId }).populate('members', 'email');
            return conversation;
        } catch (error) {
            console.error('Error finding conversation:', error);
            throw new Error('Unable to find conversation');
        }
    }

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

    static async GetRecentConversations(user: Types.ObjectId, perDocumentLimit: number = 1) {
        try {
            const cleanHistoryRecords = await CleanHistoryRepository.findAllForUser(user);
            const cleanHistoryMap = new Map(
                cleanHistoryRecords.map(record => [
                    record.conversation.toString(),
                    record.date
                ])
            );

            const populateOptionsFiles =
                perDocumentLimit !== 1
                    ? { path: 'file', model: FileModel }
                    : { path: 'file', model: FileModel, select: 'pathname' };

            const conversations = await Conversation.find({
                members: { $in: [user] },
            })
                .populate('members', 'email')
                .populate({
                    path: 'messages',
                    model: Message,
                    options: { sort: { date: -1 }, perDocumentLimit },
                    populate: populateOptionsFiles,
                });

            const filteredConversations = conversations.map((conv: any) => {
                const obj = conv.toObject();
                const cleanTime = cleanHistoryMap.get(obj._id.toString());

                if (cleanTime && obj.messages.length > 0) {
                    obj.messages = obj.messages.filter(
                        (msg: any) => new Date(msg.date) > new Date(cleanTime)
                    );
                }
                if (perDocumentLimit !== 1) {
                    obj.messages.sort(
                        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                }

                return obj;
            });
            // Sort conversations by newest message
            return filteredConversations.sort((a: any, b: any) => {
                const aDate = a.messages.at(-1)?.date;
                const bDate = b.messages.at(-1)?.date;

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

    static async DeleteConversation(member: string, conversationId: string) {
        try {
            const convo = await Conversation.findById(conversationId);
            if (!convo) {
                throw new Error("Conversation not found");
            }
            const members = convo.members || [];
            const newMembers = members.filter((m: Types.ObjectId) => m.toString() !== member.toString());

            return await Conversation.updateOne(
                { _id: conversationId },
                { $set: { members: newMembers } }
            );

        } catch (err) {
            console.error("Failed to delete member from conversation:", err);
            throw err;
        }
    }
}