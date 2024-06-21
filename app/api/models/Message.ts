import { Document, Schema, models, model } from 'mongoose';
interface IMessage extends Document {
    date: Number;
    sender: string;
    value: string;
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
    }
});
export default models.Message || model('Message', MessageSchema);