import { Document, Schema, Types, models, model } from 'mongoose';

interface IConversation extends Document {
    members?: Schema.Types.ObjectId[];
    messages?: Schema.Types.ObjectId[];
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
    }
});

ConversationSchema.index({ members: 1 });
ConversationSchema.index({ messages: 1 });

export default models.Conversation || model<IConversation>('Conversation', ConversationSchema);