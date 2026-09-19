import { Document, Schema, models, model } from 'mongoose';

interface IConversation extends Document {
    members?: Schema.Types.ObjectId[];
    messages?: Schema.Types.ObjectId[];
    deletedBy?: Schema.Types.ObjectId[];
}

const ConversationSchema = new Schema<IConversation>({
    members: {
        type: [Schema.Types.ObjectId],
        ref: 'Account',
        required: false
    },
    messages: {
        type: [Schema.Types.ObjectId],
        ref: 'Message',
        required: false
    },
    deletedBy: {
        type: [Schema.Types.ObjectId],
        ref: 'Account',
        required: false,
        default: []
    }
});

ConversationSchema.index({ members: 1 });
// No index on `messages`: nothing ever queries a conversation by the message
// ids it contains (the array is only pushed to and populated), so this was a
// multikey index that grew by one entry per message sent and paid for nothing.
ConversationSchema.index({ deletedBy: 1 });

export default models?.Conversation || model<IConversation>('Conversation', ConversationSchema);