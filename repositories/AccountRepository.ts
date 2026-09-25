import Account from "../models/Account";
import { Types } from "mongoose";

function banStatusUpdate(isBanned: boolean) {
    return isBanned
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
        };
}

export default class AccountRepository {

    static async getUserByID(ID: string) {
        try {
            return await Account.findById(ID).exec();
        } catch (err) {
            console.error('Failed to find user by ID:', err);
            throw new Error('Failed to find user by ID');
        }
    }
    static async existsById(ID: string) {
        if (!Types.ObjectId.isValid(ID)) return false;
        return Boolean(await Account.exists({ _id: ID }));
    }
    static async getUsersByID(IDs: string[]) {
        try {
            const obj_ids = IDs.map(id => new Types.ObjectId(id));
            return await Account.find({ _id: { $in: obj_ids } }).select('_id email nickname avatarUrl accentColor locale lastSeen').exec();
        } catch (err) {
            console.error('Failed to find users by ID:', err);
            throw new Error('Failed to find users by ID');
        }
    }
    static async getUsersByEmails(emails: string[]) {
        try {
            return await Account.find({ email: { $in: emails } }).select('_id email nickname avatarUrl accentColor lastSeen').exec();
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
    static async addUser(email: string, hash: string, nickname?: string, phone?: string, locale?: string) {
        try {
            const result = await Account.create({ email, password: hash, nickname, phone, locale });
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
            const users = await Account.find().select('_id email nickname avatarUrl accentColor lastSeen').lean().exec();
            const chatUsers = users.map(user => ({
                _id: user._id,
                email: user.email,
                nickname: user.nickname,
                avatarUrl: user.avatarUrl,
                accentColor: user.accentColor,
                lastSeen: user.lastSeen
            }));
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
            const normalized = email?.trim().toLowerCase();
            // An empty filter would match the first account in the collection.
            if (!normalized) throw new Error('Email is required');
            return await Account.updateOne(
                { email: normalized },
                banStatusUpdate(isBanned)
            );
        } catch (err) {
            console.error('Failed to update ban status:', err);
            throw err;
        }
    }

    // Ban/unban by id so an account whose `email` field was removed can still
    // be moderated. Returns the account so callers can kick a live socket
    // when an email is still on file.
    static async updateBanStatusById(userId: string, isBanned: boolean) {
        try {
            if (!Types.ObjectId.isValid(userId)) throw new Error('Invalid user id');
            return await Account.findByIdAndUpdate(userId, banStatusUpdate(isBanned), { new: true })
                .select('_id email')
                .lean()
                .exec();
        } catch (err) {
            console.error('Failed to update ban status:', err);
            throw err;
        }
    }

    static async updateModeratorStatus(email: string, isModerator: boolean) {
        try {
            const normalized = email?.trim().toLowerCase();
            if (!normalized) throw new Error('Email is required');
            return await Account.updateOne(
                { email: normalized },
                { $set: { isModerator } }
            );
        } catch (err) {
            console.error('Failed to update moderator status:', err);
            throw err;
        }
    }

    static async updateModeratorStatusById(userId: string, isModerator: boolean) {
        try {
            if (!Types.ObjectId.isValid(userId)) throw new Error('Invalid user id');
            return await Account.findByIdAndUpdate(userId, { $set: { isModerator } }, { new: true })
                .select('_id email')
                .lean()
                .exec();
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
    // chatActions.saveMessage and socket/handlers.ts's handlePublishMessage).
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

    // Looks up an account for the profile pages by whichever identifier the
    // caller has on hand - a Mongo ObjectId (chat participant lists only
    // carry _id) or an email (own profile, or a direct link). Only ever
    // selects public-safe fields - never password/ban/blocked internals.
    static async getProfileByIdentifier(identifier: string) {
        try {
            const projection = '_id email phone nickname about avatarUrl accentColor locale lastSeen';
            if (Types.ObjectId.isValid(identifier)) {
                const byId = await Account.findById(identifier).select(projection).lean().exec();
                if (byId) return byId;
            }
            return await Account.findOne({ email: identifier?.trim().toLowerCase() }).select(projection).lean().exec();
        } catch (err) {
            console.error('Failed to find profile:', err);
            throw new Error('Failed to find profile');
        }
    }

    // The signed-in user's own account, for cookieActions.getCurrentUser: the
    // same display fields as getProfileByIdentifier plus isModerator, which
    // stays out of that shared projection because it also serves other
    // people's profiles.
    static async getSessionProfileById(userId: string) {
        try {
            if (!Types.ObjectId.isValid(userId)) return null;
            return await Account.findById(userId)
                .select('_id email nickname avatarUrl accentColor locale isModerator')
                .lean<{ email?: string; nickname?: string; avatarUrl?: string; accentColor?: string; locale?: string; isModerator?: boolean }>()
                .exec();
        } catch (err) {
            console.error('Failed to find session profile:', err);
            throw new Error('Failed to find session profile');
        }
    }

    static async updateProfile(userId: string, updates: { nickname?: string; about?: string; accentColor?: string; locale?: string; avatarUrl?: string | null; phone?: string | null }) {
        try {
            const set: Record<string, unknown> = {};
            const unset: Record<string, ''> = {};

            if (updates.nickname !== undefined) set.nickname = updates.nickname;
            if (updates.about !== undefined) {
                if (updates.about) set.about = updates.about;
                else unset.about = '';
            }
            if (updates.accentColor !== undefined) set.accentColor = updates.accentColor;
            if (updates.locale !== undefined) set.locale = updates.locale;
            if (updates.avatarUrl !== undefined) {
                if (updates.avatarUrl) set.avatarUrl = updates.avatarUrl;
                else unset.avatarUrl = '';
            }
            if (updates.phone !== undefined) {
                if (updates.phone) set.phone = updates.phone;
                else unset.phone = '';
            }

            const update: Record<string, unknown> = {};
            if (Object.keys(set).length) update.$set = set;
            if (Object.keys(unset).length) update.$unset = unset;
            if (!Object.keys(update).length) return null;

            return await Account.findByIdAndUpdate(userId, update, { new: true })
                .select('_id email phone nickname about avatarUrl accentColor locale')
                .lean()
                .exec();
        } catch (err) {
            console.error('Failed to update profile:', err);
            // Duplicate key (e.g. `phone` is unique - see models/Account.ts)
            // needs to reach the caller as-is so it can tell "already taken"
            // apart from a generic failure, rather than being flattened into
            // the same opaque error as everything else here.
            if ((err as { code?: number })?.code === 11000) throw err;
            throw new Error('Failed to update profile');
        }
    }

    // Separate from updateProfile: email is required/unique (never unsettable
    // the way the optional profile fields there can be $unset) and, unlike
    // them, doubles as the realtime-messaging identity key - see
    // profileActions.ts's confirmEmailChange, which rewrites Message.sender
    // history to match right after this call.
    static async updateEmail(userId: string, newEmail: string) {
        try {
            return await Account.findByIdAndUpdate(userId, { $set: { email: newEmail } }, { new: true })
                .select('_id email phone nickname about avatarUrl accentColor locale')
                .lean()
                .exec();
        } catch (err) {
            console.error('Failed to update email:', err);
            if ((err as { code?: number })?.code === 11000) throw err;
            throw new Error('Failed to update email');
        }
    }

    static async getAllUsersWithStatus() {
        try {
            const users = await Account.find()
                .select('_id email phone nickname isModerator isBanned banReason bannedUntil')
                .lean()
                .exec();
            return users;
        } catch (err) {
            console.error('Failed to get users with status:', err);
            throw err;
        }
    }
}
