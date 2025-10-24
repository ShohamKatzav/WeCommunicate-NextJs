import { Document, Schema, Types, models, model } from 'mongoose';

interface IInitHistory extends Document {
    date?: Date;
    account?: Schema.Types.ObjectId;
    conversation?: Schema.Types.ObjectId;
}

const InitHistorySchema = new Schema<IInitHistory>({
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

// InitHistorySchema.index({ account: 1, conversation: 1 }, { unique: true });

export default models.InitHistory || model<IInitHistory>('InitHistory', InitHistorySchema);