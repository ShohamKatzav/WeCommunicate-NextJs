import { Document, Schema, models, model } from 'mongoose';

export interface IPushSubscription extends Document {
    email: string;
    data: object;
    expiresAt: Date;
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
    },
    // The expiry of the session that registered this device (its JWT's exp),
    // so a session that ends without a logout - the token simply running
    // out - stops getting this device notified too.
    expiresAt: {
        type: Date,
        required: true
    }
});

// Allow only one sub per device even if multi devices use 
PushSubscriptionSchema.index({ email: 1, 'data.endpoint': 1 }, { unique: true });
// MongoDB's TTL sweep runs about once a minute, so reads still filter on
// expiresAt themselves (see PushService).
PushSubscriptionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models?.PushSubscription || model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
