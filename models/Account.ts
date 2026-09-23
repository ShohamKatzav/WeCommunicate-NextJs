import { Document, Schema, models, model } from 'mongoose';

export interface IAccount extends Document {
    email: string;
    phone?: string;
    nickname?: string;
    password: string;
    cleanHistory?: Date;
    location?: Schema.Types.ObjectId;

    isModerator: boolean;
    isBanned?: boolean;
    banReason?: string;
    bannedUntil?: Date;
    warningCount?: number;
    lastWarningDate?: Date;
    blocked?: Schema.Types.ObjectId[];

    avatarUrl?: string;
    about?: string;
    accentColor?: string;
    lastSeen?: Date;
}

const AccountSchema = new Schema<IAccount>({
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: { type: String, unique: true, sparse: true, trim: true },
    nickname: { type: String, trim: true, maxlength: 40 },
    password: {
        type: String,
        required: true
    },
    cleanHistory: {
        type: Date,
        required: false
    },
    location: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: false
    },
    isModerator: {
        type: Boolean,
        default: false,
        required: true
    },
    isBanned: {
        type: Boolean,
        default: false,
        index: true
    },
    banReason: {
        type: String,
        required: false
    },
    bannedUntil: {
        type: Date,
        required: false
    },
    warningCount: {
        type: Number,
        default: 0
    },
    lastWarningDate: {
        type: Date,
        required: false
    },
    // Accounts *this* account has blocked - one-directional per entry, but
    // checked both ways when deciding whether two users can message each
    // other (see AccountRepository.isBlockedEitherWay). Scoped to 1:1
    // conversations only - group chats aren't filtered by this.
    blocked: {
        type: [Schema.Types.ObjectId],
        ref: 'Account',
        required: false,
        default: []
    },

    avatarUrl: { type: String, required: false },
    about: { type: String, trim: true, maxlength: 160, required: false },
    accentColor: { type: String, required: false },

    // Written when a user's *last* socket goes away (see handleDisconnect in
    // socket/handlers.ts) - closing one of several open tabs isn't leaving.
    // Only meaningful while they're offline: presence, not this, is what says
    // whether someone is here right now.
    lastSeen: { type: Date, required: false }

});
export default models?.Account || model<IAccount>('Account', AccountSchema);
