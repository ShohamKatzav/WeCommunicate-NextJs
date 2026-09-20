import Account from "../models/Account";
import { Types } from "mongoose";

export default class AccountRepository {

    static async getUserByID(ID: string) {
        try {
            return await Account.findById(ID).exec();
        } catch (err) {
            console.error('Failed to find user by ID:', err);
            throw new Error('Failed to find user by ID');
        }
    }
    static async getUsersByID(IDs: string[]) {
        try {
            const obj_ids = IDs.map(id => new Types.ObjectId(id));
            return await Account.find({ _id: { $in: obj_ids } }).select('_id email nickname').exec();
        } catch (err) {
            console.error('Failed to find users by ID:', err);
            throw new Error('Failed to find users by ID');
        }
    }
    static async getUsersByEmails(emails: string[]) {
        try {
            return await Account.find({ email: { $in: emails } }).select('_id email nickname').exec();
        } catch (err) {
            console.error('Failed to find users by email:', err);
            throw new Error('Failed to find users by email');
        }
    }
    static async getUserByEmail(email: string) {
        try {
            // Emails are always stored lowercased (see createUser), so an
            // exact match after normalizing the input is both correct and
            // avoids building a RegExp out of user-controlled input (which
            // is both a ReDoS/injection surface and, ironically, breaks on
            // "+"-addressed emails like a+b@gmail.com being interpreted as
            // a regex quantifier).
            return await Account.findOne({ email: email?.trim().toLowerCase() }).exec();
        } catch (err) {
            console.error('Failed to find user by email:', err);
            throw new Error('Failed to find user by email');
        }
    }
    static async getUserByPhone(phone: string) {
        return Account.findOne({ phone }).exec();
    }
    static async getEmailById(accountID: Types.ObjectId) {
        try {
            const user = await Account.findById(accountID).exec();
            return user?.email;
        } catch (err) {
            console.error('Failed to find user by ID:', err);
            throw new Error('Failed to find user by ID');
        }
    }
    static async addUser(email: string, hash: string, nickname?: string, phone?: string) {
        try {
            const result = await Account.create({ email, password: hash, nickname, phone });
            return result._id;
        } catch (err) {
            console.error('Failed to create user:', err);
            throw new Error('Failed to create user');
        }
    }
    static async getUsernames() {
        try {
            // Only project the fields actually used below - this loads every
            // account (including password hashes) on every chat page render
            // otherwise.
            const users = await Account.find().select('_id email nickname').lean().exec();
            const chatUsers = users.map(user => ({ _id: user._id, email: user.email, nickname: user.nickname }));
            return chatUsers;
        } catch (err) {
            console.error('Could not get usernames:', err instanceof Error ? err.stack || err.message : err);
            // rethrow the original error for clearer diagnostics upstream
            throw err;
        }
    }

    static async updatePassword(email: string, newPassword: string) {
        try {
            return await Account.updateOne(
                { email: email },
                { $set: { password: newPassword } },
            );
        } catch (err) {
            console.error('Could not get usernames:', err instanceof Error ? err.stack || err.message : err);
            // rethrow the original error for clearer diagnostics upstream
            throw err;
        }
    }

    static async updateBanStatus(email: string, isBanned: boolean) {
        try {
            return await Account.updateOne(
                { email: email?.trim().toLowerCase() },
                isBanned
                    ? {
                        $set: {
                            isBanned: true,
                            lastWarningDate: Date.now(),
                            banReason: "Banned by moderator"
                        }
                    }
                    : {
                        $set: { isBanned: false },
                        $unset: {
                            lastWarningDate: "",
                            warningCount: "",
                            banReason: ""
                        }
                    }
            );
        } catch (err) {
            console.error('Failed to update ban status:', err);
            throw err;
        }
    }

    static async updateModeratorStatus(email: string, isModerator: boolean) {
        try {
            return await Account.updateOne(
                { email: email?.trim().toLowerCase() },
                { $set: { isModerator } }
            );
        } catch (err) {
            console.error('Failed to update moderator status:', err);
            throw err;
        }
    }

    static async updateExpiredBans(now: Date) {
        try {
            const result = await Account.updateMany(
                {
                    isBanned: true,
                    bannedUntil: { $lte: now, $ne: null }
                },
                {
                    $set: {
                        isBanned: false,
                        bannedUntil: null,
                        banReason: null
                    }
                }
            );

            return result.modifiedCount;
        } catch (err) {
            console.error('Failed to update expired bans:', err);
            throw err;
        }
    }

    static async getExpiredBans(now: Date) {
        try {
            return await Account.find({
                isBanned: true,
                bannedUntil: { $lte: now, $ne: null }
            }).select('email').lean();
        } catch (err) {
            console.error('Failed to get expired bans:', err);
            throw err;
        }
    }

    static async blockUser(blockerID: string, blockedID: string) {
        try {
            return await Account.updateOne(
                { _id: blockerID },
                { $addToSet: { blocked: new Types.ObjectId(blockedID) } }
            );
        } catch (err) {
            console.error('Failed to block user:', err);
            throw err;
        }
    }

    static async unblockUser(blockerID: string, blockedID: string) {
        try {
            return await Account.updateOne(
                { _id: blockerID },
                { $pull: { blocked: new Types.ObjectId(blockedID) } }
            );
        } catch (err) {
            console.error('Failed to unblock user:', err);
            throw err;
        }
    }

    static async getBlockedIds(userID: string): Promise<string[]> {
        try {
            const account: any = await Account.findById(userID).select('blocked').lean();
            return (account?.blocked || []).map((id: Types.ObjectId) => id.toString());
        } catch (err) {
            console.error('Failed to get blocked users:', err);
            throw err;
        }
    }

    // Checked in both directions - if either side has blocked the other,
    // messaging between them is stopped. Used to gate 1:1 sends (see
    // chatActions.saveMessage and socket/handlers.js's handlePublishMessage).
    static async isBlockedEitherWay(idA: string, idB: string): Promise<boolean> {
        try {
            const objA = new Types.ObjectId(idA);
            const objB = new Types.ObjectId(idB);
            const count = await Account.countDocuments({
                $or: [
                    { _id: objA, blocked: objB },
                    { _id: objB, blocked: objA }
                ]
            });
            return count > 0;
        } catch (err) {
            console.error('Failed to check block status:', err);
            throw err;
        }
    }

    static async getAllUsersWithStatus() {
        try {
            const users = await Account.find()
                .select('_id email isModerator isBanned banReason bannedUntil')
                .lean()
                .exec();
            return users;
        } catch (err) {
            console.error('Failed to get users with status:', err);
            throw err;
        }
    }
}
