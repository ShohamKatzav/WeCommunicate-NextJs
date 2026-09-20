import { Document, Schema, models, model } from 'mongoose';
import { MAX_MESSAGE_LENGTH } from '@/app/config/limits';

interface IReplyTo {
    messageId: Schema.Types.ObjectId;
    sender: string;
    snippet: string;
    hasFile: boolean;
}

interface IMessage extends Document {
    date: Date;
    sender: string;
    text?: string;
    status?: string;
    file?: Schema.Types.ObjectId;
    conversation: Schema.Types.ObjectId;
    replyTo?: IReplyTo;
    expiresAt?: Date;
}

const MessageSchema = new Schema<IMessage>({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    sender: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: false,
        maxlength: [MAX_MESSAGE_LENGTH, `A message cannot be longer than ${MAX_MESSAGE_LENGTH} characters`]
    },
    status: {
        type: String,
        required: false,
        default: "sent"
    },
    file: {
        type: Schema.Types.ObjectId,
        ref: 'FileModel',
        required: false
    },
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    // Denormalized snapshot of the message being replied to, taken at send
    // time - not a live reference. The quoted message may be many pages back
    // (only a handful of messages are loaded at once, see MoreMessagesLoader),
    // so joining against it on every read isn't worth it, and this way the
    // quote still renders correctly even if the original is later deleted.
    replyTo: {
        type: {
            messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
            sender: { type: String, required: true },
            snippet: { type: String, required: false },
            hasFile: { type: Boolean, required: false, default: false }
        },
        required: false,
        _id: false
    },
    // Set at send time from the conversation's disappearingMessagesSeconds
    // setting (see Conversation.ts) - undefined means "never expires".
    // Deletion itself is handled entirely by Atlas's TTL monitor via the
    // index below, not application code: no cron/server timer needed, so
    // Render's free-tier spin-down can't interfere with it. That monitor
    // only sweeps roughly once a minute, so expiry is approximate, not
    // instant - don't rely on it for anything tighter than that.
    //
    // Known gap: this only deletes the Message document. The FileModel doc
    // and the actual blob storage object for an expired message's
    // attachment are orphaned - cleaning those up needs a separate pass
    // (e.g. a scheduled job diffing FileModel against still-referenced
    // files) that's out of scope here.
    expiresAt: {
        type: Date,
        required: false
    }
});

// Every message read goes through getMessages/countMessages, both of which
// filter by conversation (and often date) - without this index those are
// full collection scans. Message search (MessageRepository.SearchMessages)
// also relies on this to narrow to a single user's own conversations before
// running its regex match - a $text index was tried first but only matches
// whole words, which breaks search-as-you-type (e.g. "offli" never matching
// "offline"), so it was dropped in favor of a regex scan over this
// already-narrowed set.
MessageSchema.index({ conversation: 1, date: 1 });

// TTL index: expireAfterSeconds: 0 means "delete at expiresAt", not
// "expiresAt seconds after insertion" - the actual expiry instant is
// computed at send time (see expiresAt's own comment) and stored directly.
// Documents without expiresAt are never touched by this index.
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models?.Message || model<IMessage>('Message', MessageSchema);