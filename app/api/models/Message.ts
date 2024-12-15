import { Document, Schema, Types, models, model } from 'mongoose';

interface IMessage extends Document {
    date: Number;
    sender: string;
    value: string;
    conversation: Types.ObjectId;
}

const MessageSchema = new Schema<IMessage>({
    date: {
        type: Date,
        required: true
    },
    sender: {
        type: String,
        required: true
    },
    value: {
        type: String,
        required: true
    },
    conversation: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    }
});
export default models.Message || model<IMessage>('Message', MessageSchema);