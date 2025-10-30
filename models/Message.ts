import { Document, Schema, models, model } from 'mongoose';

interface IMessage extends Document {
    date: Date;
    sender: string;
    text?: string;
    file?: Schema.Types.ObjectId;
    conversation: Schema.Types.ObjectId;
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
    text: {
        type: String,
        required: false
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