import { Document, Schema } from 'mongoose';
interface ILocation extends Document {
    latitude: Number;
    longitude: Number;
    accuracy: Number;
    error: String;
    time: Date;
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
    }
});