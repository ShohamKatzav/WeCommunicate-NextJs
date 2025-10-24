import { Document, Schema, models, model } from 'mongoose';

export interface IAccount extends Document {
    _id: Schema.Types.ObjectId;
    email: string;
    password: string;
    initHistory?: Date;
    location?: Schema.Types.ObjectId;
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
    initHistory: {
        type: Date,
        required: false
    },
    location: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: false
    }
});
export default models.Account || model<IAccount>('Account', AccountSchema);