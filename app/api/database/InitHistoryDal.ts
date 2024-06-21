import Account from "../models/Account"
import AccountRepository from "./AccountDal";
import { Types } from 'mongoose';

export default class InitHistoryRepository {
    static async findInitHistory(accountId: Types.ObjectId) {
        try {
            const account = await Account.findById(accountId).exec();
            return account.initHistory;
        } catch (err) {
            console.error('Failed to find Init History time:', err);
            throw err;
        }
    }
    static async updateInitHistory(email: string) {
        try {
            const account = await AccountRepository.getUserByEmail(email);
            return await Account.updateOne({ _id: account._id }, { $set: { initHistory:  Date.now() } });
        } catch (err) {
            console.error('Failed to update Init History time:', err);
            throw err;
        }
    }
}