import Message from "../models/Message";
import FileModel from "../models/FileModel";
import Conversation from "../models/Conversation";
import ConversationRepository from "./ConversationRepository";
import CleanHistoryRepository from "./CleanHistoryRepository";
import { Schema, Types } from 'mongoose';
import MessageDTO from '@/types/messageDTO';
import BlobService from '@/services/BlobService';
import MessageSearchResult from '@/types/messageSearchResult';
import { MAX_SEARCH_MATCHES_SCANNED, MAX_SEARCH_RESULTS, MAX_MATCHES_PER_CONVERSATION, REPLY_SNIPPET_LENGTH } from '@/app/config/limits';

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
            const { date, sender, participantID, text, file, location, replyTo } = data;
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

            // Only the referenced message's id is trusted from the client -
            // sender/snippet are re-derived from the DB record itself, and
            // only if that message actually belongs to this conversation.
            // Otherwise a client could fabricate a reply quote attributing
            // arbitrary fake text to another user (or reach into a
            // conversation it isn't part of).
            let replyToSnapshot;
            if (replyTo?.messageId && Types.ObjectId.isValid(replyTo.messageId)) {
                const repliedMessage: any = await Message.findOne({
                    _id: replyTo.messageId,
                    conversation: conversation._id,
                    status: { $ne: 'revoked' }
                }).select('sender text file location').populate('file', 'pathname').lean();

                // A file or a pin is quoted with an empty snippet and a flag
                // rather than English words stored in the database - each
                // reader's UI names it in their own language.
                if (repliedMessage) {
                    replyToSnapshot = {
                        messageId: repliedMessage._id,
                        sender: repliedMessage.sender,
                        snippet: repliedMessage.text
                            ? repliedMessage.text.slice(0, REPLY_SNIPPET_LENGTH)
                            : '',
                        hasFile: !!repliedMessage.file,
                        hasLocation: !!repliedMessage.location
                    };
                }
            }

            // Disappearing messages: only applied at send time, from
            // whatever the conversation's setting is right now - changing
            // the setting later never retroactively affects already-sent
            // messages (see disappearingMessagesSeconds' own schema comment).
            const expiresAt = conversation.disappearingMessagesSeconds
                ? new Date(Date.now() + conversation.disappearingMessagesSeconds * 1000)
                : undefined;

            const newMessage = await Message.create({
                date,
                sender,
                text,
                file: newFileId,
                location,
                conversation: conversation._id,
                replyTo: replyToSnapshot,
                expiresAt
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

    // Scoped to the caller's own conversations server-side (never trusts a
    // conversation id from the client) - otherwise this would let any logged
    // in user full-text search everyone else's messages too.
    static async SearchMessages(userID: Types.ObjectId, searchTerm: string): Promise<MessageSearchResult[]> {
        try {
            const memberConversations = await Conversation.find({
                members: userID,
                deletedBy: { $nin: [userID] }
            }).select('_id').lean();

            if (memberConversations.length === 0) return [];
            const conversationIds = memberConversations.map(c => c._id);

            const cleanHistoryRecords = await CleanHistoryRepository.findAllForUser(userID);
            const cleanHistoryMap = new Map(
                cleanHistoryRecords.map(record => [record.conversation.toString(), record.date])
            );

            // A $text index only matches whole (stemmed) words, so "offli"
            // would never match "offline" - wrong for search-as-you-type,
            // where the user is mid-word on every keystroke. A case-insensitive
            // substring regex matches what people actually expect here, at
            // the cost of not being index-accelerated on `text` itself - the
            // conversation scoping above (backed by the conversation+date
            // index) already narrows this to a single user's own messages,
            // which is a small enough set for a regex scan to be fine.
            // Escaped because this is user input going straight into a
            // RegExp - unescaped, it's both a regex-injection and a ReDoS risk.
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const matches = await Message.find({
                conversation: { $in: conversationIds },
                status: { $ne: 'revoked' },
                text: { $regex: escapedTerm, $options: 'i' }
            })
                .sort({ date: -1 })
                .limit(MAX_SEARCH_MATCHES_SCANNED)
                .select('text date sender conversation')
                .lean();

            // Grouped by conversation (up to MAX_MATCHES_PER_CONVERSATION
            // matches each, most recent first, since `matches` is already
            // sorted newest-first) - the UI opens a conversation, not a
            // single message, but a conversation with several matches
            // should still show more than just one of them.
            const matchesByConversation = new Map<string, any[]>();
            const totalCountByConversation = new Map<string, number>();
            for (const msg of matches) {
                const conversationID = msg.conversation.toString();
                const cleanTime = cleanHistoryMap.get(conversationID);
                if (cleanTime && new Date(msg.date) <= new Date(cleanTime)) continue;

                let list = matchesByConversation.get(conversationID);
                if (!list) {
                    if (matchesByConversation.size >= MAX_SEARCH_RESULTS) continue;
                    list = [];
                    matchesByConversation.set(conversationID, list);
                }
                if (list.length < MAX_MATCHES_PER_CONVERSATION) {
                    list.push(msg);
                }
                totalCountByConversation.set(conversationID, (totalCountByConversation.get(conversationID) || 0) + 1);
            }

            return Array.from(matchesByConversation.entries()).map(([conversationID, msgs]) => ({
                conversationID,
                matches: msgs.map(msg => ({
                    text: msg.text,
                    date: msg.date,
                    sender: msg.sender
                })),
                moreCount: (totalCountByConversation.get(conversationID) || 0) - msgs.length
            }));
        } catch (err) {
            console.error('Failed to search messages:', err);
            throw err;
        }
    }

    // A sender holds at most one reaction per message, so picking a second
    // emoji replaces the first rather than adding to it. The pull/push pair
    // is scoped to this sender's own entry, which keeps two people reacting
    // at the same moment from overwriting each other the way writing back a
    // whole recomputed array would.
    static async ToggleReaction(messageId: string, senderEmail: string, emoji: string, memberID: Types.ObjectId) {
        try {
            const message: any = await Message.findOne({ _id: messageId, status: { $ne: 'revoked' } })
                .select('conversation reactions')
                .lean();
            if (!message) return null;

            // Only someone actually in the conversation may react to what's
            // in it - message ids are otherwise guessable, and this would
            // let any logged-in user annotate a stranger's messages.
            const isMember = await Conversation.exists({ _id: message.conversation, members: memberID });
            if (!isMember) return null;

            const existing = (message.reactions || []).find(
                (reaction: any) => reaction.sender?.toLowerCase() === senderEmail.toLowerCase()
            );
            const isRemoving = existing?.emoji === emoji;

            await Message.updateOne({ _id: messageId }, { $pull: { reactions: { sender: senderEmail } } });
            if (!isRemoving) {
                await Message.updateOne({ _id: messageId }, { $push: { reactions: { emoji, sender: senderEmail } } });
            }

            const updated: any = await Message.findById(messageId).select('reactions').lean();
            return {
                reactions: updated?.reactions || [],
                conversationId: message.conversation.toString()
            };
        } catch (err) {
            console.error('Failed to toggle reaction:', err);
            throw err;
        }
    }

    // The message requesterEmail may edit, or null. Only the sender's own
    // message, and only one that still has text: a deleted message, a call
    // record, a location pin, or a file/voice message sent without text has
    // nothing to edit. requesterEmail must come from a verified identity (the
    // caller's account), never from anything the client sent.
    static async GetEditableMessage(id: string, requesterEmail: string) {
        try {
            if (!requesterEmail || !Types.ObjectId.isValid(id)) return null;
            const message: any = await Message.findOne({ _id: id })
                .select('sender text status call location conversation')
                .lean();
            if (!message) return null;
            if (message.sender?.toLowerCase() !== requesterEmail.toLowerCase()) return null;
            if (message.status === 'revoked' || message.call || message.location) return null;
            if (typeof message.text !== 'string' || !message.text.trim()) return null;
            return message as { _id: Types.ObjectId; conversation: Types.ObjectId; text: string };
        } catch (err) {
            console.error('Failed to find message to edit:', err);
            throw err;
        }
    }

    // `message` is what GetEditableMessage returned. The write repeats its
    // "still has text, not deleted" conditions so a delete that lands in
    // between wins. Reply quotes are snapshots taken at send time (see
    // SaveMessage), so the ones quoting this message are refreshed here too -
    // their sender stays as it is, only the snippet follows the new text.
    static async editMessage(message: { _id: Types.ObjectId; conversation: Types.ObjectId }, text: string) {
        try {
            const result = await Message.updateOne(
                { _id: message._id, status: { $ne: 'revoked' }, text: { $exists: true, $ne: '' } },
                { $set: { text, edited: true } }
            );
            if (result.matchedCount === 0) return null;

            await Message.updateMany(
                { conversation: message.conversation, 'replyTo.messageId': message._id },
                { $set: { 'replyTo.snippet': text.slice(0, REPLY_SNIPPET_LENGTH) } }
            );

            return {
                messageId: message._id.toString(),
                conversationId: message.conversation.toString(),
                text,
                edited: true
            };
        } catch (err) {
            console.error('Failed to edit message:', err);
            throw err;
        }
    }

    // requesterEmail must come from a verified identity (the caller's
    // account), never from anything the client sent.
    static async deleteMessage(id: string, requesterEmail: string) {
        try {
            if (!requesterEmail) return null;
            const messageObjectId = new Types.ObjectId(id);

            const messageToDelete = await Message.findOne({ _id: messageObjectId });
            if (!messageToDelete) return null;

            if (messageToDelete.sender?.toLowerCase() !== requesterEmail.toLowerCase()) return null;

            // The file itself too, not just the message's link to it: once
            // unlinked, nothing ties a blob back to its sender, so it could
            // never be removed later - not even when the account is deleted.
            // Best-effort: the message is still revoked if storage fails.
            if (messageToDelete.file) {
                try {
                    const file = await FileModel.findById(messageToDelete.file).select('url').lean<{ url?: string } | null>();
                    await BlobService.deleteBlobs([file?.url]);
                    await FileModel.deleteOne({ _id: messageToDelete.file });
                } catch (err) {
                    console.error("Failed to delete a deleted message's file:", err);
                }
            }

            // Actually strip the content, not just mark it revoked - the
            // client only hides revoked messages in its UI, so leaving text
            // in the document means anyone reading the API response (e.g.
            // devtools) can still see "deleted" messages.
            return await Message.updateOne(
                { _id: messageObjectId },
                {
                    $set: { status: "revoked" },
                    $unset: { text: "", file: "", location: "", reactions: "" }
                }
            );
        } catch (err) {
            console.error("Failed to delete message:", err);
            throw err;
        }
    }
}