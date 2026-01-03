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
ConversationSchema.index({ messages: 1 });
ConversationSchema.index({ deletedBy: 1 });

export default models?.Conversation || model<IConversation>('Conversation', ConversationSchema);