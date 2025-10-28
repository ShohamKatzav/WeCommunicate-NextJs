import CleanHistory from "../models/CleanHistory"
import { Types } from "mongoose";

export default class CleanHistoryRepository {
    static async findCleanHistory(accountID: Types.ObjectId, conversationID: string) {
        try {
            return await CleanHistory.findOne(
                { account: accountID, conversation: conversationID }).exec();
        } catch (err) {
            console.error('Failed to find Clean History time:', err);
            throw err;
        }
    }
    static async updateCleanHistory(accountID: string, conversationID: string) {
        try {
            return await CleanHistory.updateOne(
                { account: accountID, conversation: conversationID },
                { $set: { date: Date.now() } },
                { upsert: true }
            );
        } catch (err) {
            console.error('Failed to update Clean History time:', err);
            throw err;
        }
    }
}