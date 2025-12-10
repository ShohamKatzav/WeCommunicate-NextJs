import { Document, Schema, models, model } from 'mongoose';

export interface IPushSubscription extends Document {
    email: string;
    data: object;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>({
    email: {
        type: String,
        required: true,
        index: true
    },
    data: {
        type: Object,
        required: true
    }
});

// Allow only one sub per device even if multi devices use 
PushSubscriptionSchema.index({ email: 1, 'data.endpoint': 1 }, { unique: true });

export default models?.PushSubscription || model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);