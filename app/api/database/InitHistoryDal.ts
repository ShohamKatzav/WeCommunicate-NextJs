import InitHistory from "../models/InitHistory"
import { Types } from "mongoose";

export default class InitHistoryRepository {
    static async findInitHistory(accountID: Types.ObjectId, conversationID: string) {
        try {
            return await InitHistory.findOne(
                { account: accountID, conversation: conversationID }).exec();
        } catch (err) {
            console.error('Failed to find Init History time:', err);
            throw err;
        }
    }
    static async updateInitHistory(accountID: string, conversationID: string) {
        try {
            return await InitHistory.updateOne(
                { account: accountID, conversation: conversationID },
                { $set: { date: Date.now() } },
                { upsert: true }
            );
        } catch (err) {
            console.error('Failed to update Init History time:', err);
            throw err;
        }
    }
}