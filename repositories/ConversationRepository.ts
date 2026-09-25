import Conversation from "../models/Conversation";
import Account from "../models/Account";
import { Types } from 'mongoose';
import Message from "../models/Message";
import FileModel from "../models/FileModel";
import CleanHistoryRepository from "./CleanHistoryRepository";

// A conversation with no deleted members. `$in: [null, []]` also matches
// documents from before the field existed.
const NO_DELETED_MEMBERS = { deletedMembers: { $in: [null, []] } };

export default class ConversationRepository {

    // What clients get for each member whose account was deleted: just the
    // old id, flagged, so the conversation keeps its shape (a 1:1 stays a
    // 1:1 with "Deleted account", and opening it by its members still finds
    // it) without anything about who they were.
    static withDeletedMembers<T extends { _id?: { toString(): string }; members?: unknown[]; deletedMembers?: { toString(): string }[] }>(conversation: T): T {
        let placeholders = (conversation.deletedMembers ?? []).map(id => ({ _id: id.toString(), deleted: true }));
        // A conversation always starts with at least two members, so one left
        // with a single member lost the other to an account deleted before
        // deletedMembers existed. Its id is gone; the conversation's own
        // stands in (it can't be anyone's account id).
        if (placeholders.length === 0 && (conversation.members?.length ?? 0) === 1 && conversation._id) {
            placeholders = [{ _id: conversation._id.toString(), deleted: true }];
        }
        const { deletedMembers: _omit, ...rest } = conversation;
        return { ...rest, members: [...(conversation.members ?? []), ...placeholders] } as unknown as T;
    }

    // The conversation with exactly these members, where some may be deleted
    // accounts (their placeholder ids come back from clients). The common
    // case - everyone still here - is the plain indexed match; only when that
    // misses are the ids checked against live accounts. Returns the split so
    // a caller about to create a conversation can refuse deleted accounts.
    private static async findByMemberIds(members: Types.ObjectId[]) {
        const sorted = this.sortMemberIDs(members);
        const clean = await Conversation.findOne({ members: sorted, ...NO_DELETED_MEMBERS });
        if (clean) return { conversation: clean, deleted: [] as Types.ObjectId[] };

        const liveIds = new Set((await Account.find({ _id: { $in: sorted } }).select('_id').lean<{ _id: Types.ObjectId }[]>())
            .map(account => account._id.toString()));
        const live = sorted.filter(id => liveIds.has(id.toString()));
        const deleted = sorted.filter(id => !liveIds.has(id.toString()));
        if (deleted.length === 0) return { conversation: null, deleted };

        const conversation = await Conversation.findOne({
            members: live,
            deletedMembers: { $all: deleted, $size: deleted.length },
        });
        return { conversation, deleted };
    }

    static async GetConversationById(conversationId: string) {
        try {
            const conversation = await Conversation.findOne({ _id: conversationId }).populate('members', 'email nickname avatarUrl accentColor lastSeen');
            return conversation;
        } catch (error) {
            console.error('Error finding conversation:', error);
            throw new Error('Unable to find conversation');
        }
    }

    private static sortMemberIDs(members: Types.ObjectId[]) {
        return members
            .map(id => id.toString())
            .sort()
            .map(id => new Types.ObjectId(id));
    }

    // The read-only half of GetOrCreateConversationByMembers: the same
    // sorted exact-members match, so it finds the very document a first
    // message would be written to - including one the caller deleted
    // (deletedBy only hides it from their list; it's the same conversation).
    static async FindConversationIdByMembers(members: Types.ObjectId[]): Promise<string | null> {
        try {
            const { conversation } = await this.findByMemberIds(members);
            return conversation ? conversation._id.toString() : null;
        } catch (error) {
            console.error('Error in FindConversationIdByMembers:', error);
            throw new Error('Unable to find conversation');
        }
    }

    static async GetOrCreateConversationByMembers(members: Types.ObjectId[]) {
        try {
            const sortedMemberIDs = this.sortMemberIDs(members);

            const existing = await this.findByMemberIds(sortedMemberIDs);
            if (existing.conversation) return existing.conversation;
            // Never a new conversation around an account that no longer exists.
            if (existing.deleted.length > 0) throw new Error('Conversation includes a deleted account');

            let conversation = await Conversation.findOneAndUpdate(
                { members: sortedMemberIDs, ...NO_DELETED_MEMBERS },
                {
                    $setOnInsert: {
                        members: sortedMemberIDs,
                        messages: []
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );
            return conversation;
        } catch (error) {
            console.error('Error in GetConversationByMembers:', error);
            throw new Error('Unable to find or create conversation');
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
                deletedBy: { $nin: [user] }
            })
                .populate('members', 'email nickname avatarUrl accentColor lastSeen')
                .populate({
                    path: 'messages',
                    model: Message,
                    options: { sort: { date: -1 }, perDocumentLimit },
                    populate: populateOptionsFiles,
                });

            const filteredConversations = conversations.map((conv: any) => {
                const obj = this.withDeletedMembers(conv.toObject());
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

    // Scoped to members only - the caller (conversationActions.ts) verifies
    // membership before calling this, but the query filter is kept here too
    // as a second line of defence against a non-member changing a
    // conversation they can't otherwise see.
    static async SetDisappearingMessages(conversationId: string, memberID: Types.ObjectId, seconds: number) {
        try {
            return await Conversation.updateOne(
                { _id: conversationId, members: memberID },
                { $set: { disappearingMessagesSeconds: seconds } }
            );
        } catch (err) {
            console.error('Failed to set disappearing messages:', err);
            throw err;
        }
    }

    static async DeleteConversation(member: string, conversationId: string) {
        try {
            const convo = await Conversation.findById(conversationId);
            if (!convo) {
                throw new Error("Conversation not found");
            }
            return await Conversation.updateOne(
                { _id: conversationId },
                { $addToSet: { deletedBy: new Types.ObjectId(member) } }
            );

        } catch (err) {
            console.error("Failed to delete member from conversation:", err);
            throw err;
        }
    }
}
