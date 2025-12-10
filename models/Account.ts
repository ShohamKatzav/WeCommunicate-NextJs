import { Document, Schema, models, model } from 'mongoose';

export interface IAccount extends Document {
    email: string;
    password: string;
    cleanHistory?: Date;
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
    cleanHistory: {
        type: Date,
        required: false
    },
    location: {
        type: Schema.Types.ObjectId,
        ref: 'Location',
        required: false
    }
});
export default models?.Account || model<IAccount>('Account', AccountSchema);