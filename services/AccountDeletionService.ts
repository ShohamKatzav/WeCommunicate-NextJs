import { Types } from 'mongoose';
import Account from '@/models/Account';
import Message from '@/models/Message';
import FileModel from '@/models/FileModel';
import Conversation from '@/models/Conversation';
import CleanHistory from '@/models/CleanHistory';
import Location from '@/models/Location';
import PushSubscription from '@/models/PushSubscription';
import ModerationViolation from '@/models/ModerationViolation';
import RedisService from '@/services/RedisService';
import BlobService from '@/services/BlobService';
import { isEmail, otpContactKey } from '@/app/lib/contact';

export interface DeletableAccount {
    _id: Types.ObjectId | string;
    email: string;
    phone?: string;
    avatarUrl?: string;
}

type IdDoc = { _id: Types.ObjectId };
type MessageFileDoc = IdDoc & { file?: Types.ObjectId };

// Removes a person from the app: their account and everything that is theirs,
// while other people's conversations and messages stay. Not a server action -
// app/lib/accountDeletionActions.ts calls it only after the account's own
// verification code checks out.
//
// Ordered so a failure part way leaves something retryable: Redis keys
// (codes, counters - all disposable) and files first, since deleting either
// twice is harmless and a storage failure then stops before any database
// change; the account row last, so a half-done deletion can simply be asked
// for again with a new code.
export default class AccountDeletionService {
    static async deleteAccount(account: DeletableAccount) {
        const id = new Types.ObjectId(account._id.toString());
        const email = account.email;

        // Messages are attributed by the sender's email (see socket/handlers.ts).
        const sent = await Message.find({ sender: email }).select('_id file').lean<MessageFileDoc[]>();

        // Conversations they're in. A conversation left with nobody in it
        // goes, with whatever was in it; the rest carry on (see below).
        const theirs = await Conversation.find({ members: id })
            .select('_id members deletedBy disappearingMessagesSeconds')
            .lean<(IdDoc & { members?: Types.ObjectId[]; deletedBy?: Types.ObjectId[]; disappearingMessagesSeconds?: number })[]>();
        const emptiedIds = theirs.filter(c => (c.members ?? []).every(m => m.equals(id))).map(c => c._id);
        const orphaned = emptiedIds.length
            ? await Message.find({ conversation: { $in: emptiedIds } }).select('_id file').lean<MessageFileDoc[]>()
            : [];

        const doomed = [...sent, ...orphaned];
        const messageIds = doomed.map(m => m._id);
        const fileIds = doomed.flatMap(m => m.file ? [m.file] : []);
        const files = fileIds.length
            ? await FileModel.find({ _id: { $in: fileIds } }).select('url').lean<{ url?: string }[]>()
            : [];

        // Redis before the files: it hands back any share still waiting to be
        // picked up, whose uploaded file goes with the rest.
        const otpContacts = [
            ...(isEmail(email) ? [otpContactKey(email, 'email')] : []),
            ...(account.phone ? [otpContactKey(account.phone, 'sms')] : []),
        ];
        const pendingShares = await RedisService.deleteAccountKeys({
            email,
            phone: account.phone,
            userId: id.toString(),
            otpContacts,
        });

        await BlobService.deleteBlobs([
            ...files.map(f => f.url),
            ...pendingShares.map(share => share.file?.url),
            account.avatarUrl,
        ]);

        await FileModel.deleteMany({ _id: { $in: fileIds } });
        await Message.deleteMany({ _id: { $in: messageIds } });
        await Conversation.updateMany({ messages: { $in: messageIds } }, { $pull: { messages: { $in: messageIds } } });

        // What they left on other people's messages: their reactions, and
        // replies quoting them (the quote carries their email and a snippet
        // of the message that is now gone).
        await Message.updateMany({ 'reactions.sender': email }, { $pull: { reactions: { sender: email } } });
        await Message.updateMany({ 'replyTo.sender': email }, { $unset: { replyTo: '' } });

        // The conversations that carry on: they keep an anonymous "Deleted
        // account" where this person was (deletedMembers - see
        // ConversationRepository.withDeletedMembers), and a notice saying so,
        // unread, for whoever is left - rather than a chat that's suddenly
        // with no one. Nothing of theirs stays: no name, no messages.
        const carryOn = theirs.filter(c => !emptiedIds.some(e => e.equals(c._id)));
        for (const conversation of carryOn) {
            const notice = await Message.create({
                sender: 'system',
                system: 'account-deleted',
                conversation: conversation._id,
                status: 'sent',
                expiresAt: conversation.disappearingMessagesSeconds
                    ? new Date(Date.now() + conversation.disappearingMessagesSeconds * 1000)
                    : undefined,
            });
            await Conversation.updateOne(
                { _id: conversation._id },
                { $pull: { members: id, deletedBy: id }, $addToSet: { deletedMembers: id }, $push: { messages: notice._id } }
            );
            // An unread badge for the others, except anyone who had hidden
            // this conversation - it stays hidden for them.
            const others = (conversation.members ?? []).filter(m => !m.equals(id) && !(conversation.deletedBy ?? []).some(d => d.equals(m)));
            const recipients = others.length
                ? await Account.find({ _id: { $in: others } }).select('email').lean<{ email?: string }[]>()
                : [];
            for (const recipient of recipients) {
                if (recipient.email) await RedisService.incrNotification(recipient.email, conversation._id.toString(), 1);
            }
        }
        await Conversation.deleteMany({ _id: { $in: emptiedIds } });
        await CleanHistory.deleteMany({ $or: [{ account: id }, { conversation: { $in: emptiedIds } }] });

        await Location.deleteMany({ account: id });
        await PushSubscription.deleteMany({ email });
        await ModerationViolation.deleteMany({ user: id });

        // Other people's block lists; their own goes with the account row,
        // as do the moderator role and any ban.
        await Account.updateMany({ blocked: id }, { $pull: { blocked: id } });
        await Account.deleteOne({ _id: id });
    }
}
