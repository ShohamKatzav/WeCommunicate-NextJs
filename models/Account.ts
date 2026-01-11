import { Document, Schema, models, model } from 'mongoose';

export interface IAccount extends Document {
    email: string;
    password: string;
    cleanHistory?: Date;
    location?: Schema.Types.ObjectId;

    isModerator: boolean;
    isBanned?: boolean;
    banReason?: string;
    bannedUntil?: Date;
    warningCount?: number;
    lastWarningDate?: Date;
}

const AccountSchema = new Schema<IAccount>({
    email: {
        type: String,
        required: true
    },
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
    }

});
export default models?.Account || model<IAccount>('Account', AccountSchema);