import { Document, Schema, models, model } from 'mongoose';

interface ICleanHistory extends Document {
    date?: Date;
    account?: Schema.Types.ObjectId;
    conversation?: Schema.Types.ObjectId;
}

const CleanHistorySchema = new Schema<ICleanHistory>({
    date: {
        type: Date,
        required: true
    },
    account: {
        type: Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    },
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    }
});

// CleanHistorySchema.index({ account: 1, conversation: 1 }, { unique: true });

export default models.CleanHistory || model<ICleanHistory>('CleanHistory', CleanHistorySchema);