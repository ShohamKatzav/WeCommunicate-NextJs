import { Document, Schema, models, model } from 'mongoose';
import { LocationSchema } from './Location';

interface IAccount extends Document {
    email: string;
    password: string;
    location: Location;
    initHistory: Date;
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
    location: LocationSchema,
    initHistory:{
        type: Date,
        required: false
    }
});
export default models.Account || model('Account', AccountSchema);