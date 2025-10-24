import { Document, Schema, Types, models, model } from 'mongoose';
interface ILocation extends Document {
    latitude: number;
    longitude: number;
    accuracy: number;
    error?: String;
    time: Date;
    account: Schema.Types.ObjectId;
}

export const LocationSchema = new Schema<ILocation>({
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    accuracy: {
        type: Number,
        required: true
    },
    error: {
        type: String,
        required: false
    },
    time: {
        type: Date,
        required: true
    },
    account: {
        type: Schema.Types.ObjectId,
        ref: 'Account',
        required: true
    }
});
export default models.Location || model<ILocation>('Location', LocationSchema);