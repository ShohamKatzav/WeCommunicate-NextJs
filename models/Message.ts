import { Document, Schema, models, model } from 'mongoose';

interface IMessage extends Document {
    date: Date;
    sender: string;
    text?: string;
    status?: string;
    file?: Schema.Types.ObjectId;
    conversation: Schema.Types.ObjectId;
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
        required: false
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
    }
});
export default models.Message || model<IMessage>('Message', MessageSchema);