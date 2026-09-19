import Message from "../models/Message";
import FileModel from "../models/FileModel";
import Conversation from "../models/Conversation";
import ConversationRepository from "./ConversationRepository";
import { Schema, Types } from 'mongoose';
import MessageDTO from '@/types/messageDTO';
import { extractUsersEmailFromCoockie } from "@/app/lib/cookieActions";

type ChatQuery = {
    date?: {
        $gt?: any;
    };
    conversation: Schema.Types.ObjectId; // Ensure query includes conversation
};

export default class MessageRepository {
    static async GetMessages(query: ChatQuery, limit: number, skip: number) {
        try {
            // The skip/limit math in chatActions.getMessages assumes ascending
            // (oldest-first) order - without an explicit sort this relied on
            // MongoDB's natural insertion order, which isn't guaranteed and
            // can silently reorder pages (e.g. after any update that moves a
            // document). _id is a stable tiebreaker for messages sharing a date.
            return await Message.find(query)
                .sort({ date: 1, _id: 1 })
                .skip(skip)
                .limit(limit)
                .populate("file")
                .lean()
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

            let conversation = await ConversationRepository.GetOrCreateConversationByMembers(memberIDs);

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
            await Conversation.updateOne(
                { _id: conversation._id },
                { $set: { deletedBy: [] } }
            );
            conversation.messages.push(newMessage._id);
            await conversation.save();
            await newMessage.populate('file');
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

    static async deleteMessage(id: string) {
        try {
            const requestSenderEmail = await extractUsersEmailFromCoockie();
            const messageObjectId = new Types.ObjectId(id);

            const messageToDelete = await Message.findOne({ _id: messageObjectId });
            if (!messageToDelete) return null;

            if (messageToDelete.sender !== requestSenderEmail) return null;

            // Actually strip the content, not just mark it revoked - the
            // client only hides revoked messages in its UI, so leaving text
            // in the document means anyone reading the API response (e.g.
            // devtools) can still see "deleted" messages.
            return await Message.updateOne(
                { _id: messageObjectId },
                {
                    $set: { status: "revoked" },
                    $unset: { text: "", file: "" }
                }
            );
        } catch (err) {
            console.error("Failed to delete message:", err);
            throw err;
        }
    }
}