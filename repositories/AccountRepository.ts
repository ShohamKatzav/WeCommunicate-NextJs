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
            return await Account.find({ _id: { $in: obj_ids } }).exec();
        } catch (err) {
            console.error('Failed to find users by ID:', err);
            throw new Error('Failed to find users by ID');
        }
    }
    static async getUsersByEmails(emails: string[]) {
        try {
            return await Account.find({ email: { $in: emails } }).exec();
        } catch (err) {
            console.error('Failed to find users by email:', err);
            throw new Error('Failed to find users by email');
        }
    }
    static async getUserByEmail(email: string) {
        try {
            return await Account.findOne({
                email: { $regex: new RegExp("^" + email + "$", "i") }
            }).exec();
        } catch (err) {
            console.error('Failed to find user by email:', err);
            throw new Error('Failed to find user by email');
        }
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
    static async addUser(email: string, hash: string) {
        try {
            const result = await Account.create({ email, password: hash });
            return result._id;
        } catch (err) {
            console.error('Failed to create user:', err);
            throw new Error('Failed to create user');
        }
    }
    static async getUsernames() {
        try {
            const users = await Account.find().exec();
            const chatUsers = users.map(user => ({ _id: user._id, email: user.email }));
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
                { email: { $regex: new RegExp("^" + email + "$", "i") } },
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
                { email: { $regex: new RegExp("^" + email + "$", "i") } },
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