import { Document, Schema, Types, models, model } from 'mongoose';

export interface IAccount extends Document {
    _id: Types.ObjectId;
    email: string;
    password: string;
    initHistory?: Date;
    location?: Types.ObjectId;
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