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
    // $max instead of $set: a cutoff may only ever move forward. Without
    // this, an offline replay carrying an older click-time timestamp than
    // whatever's already stored (e.g. a second, more recent clear already
    // synced first) would rewind the cutoff and uncover messages a later
    // clear had already hidden. With upsert, $max still creates the
    // document on first write exactly like $set did.
    static async updateCleanHistory(accountID: string, conversationID: string, date: number = Date.now()) {
        try {
            return await CleanHistory.updateOne(
                { account: accountID, conversation: conversationID },
                { $max: { date: new Date(date) } },
                {
                    upsert: true,
                    writeConcern: { w: 'majority', j: true }
                }
            );
        } catch (err) {
            console.error('Failed to update Clean History time:', err);
            throw err;
        }
    }

    static async findAllForUser(userID: Types.ObjectId) {
        return await CleanHistory.find({ account: userID })
            .select('conversation date')
            .lean();
    }
}