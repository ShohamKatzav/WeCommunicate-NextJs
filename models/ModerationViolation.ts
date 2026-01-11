import { Document, Schema, models, model } from 'mongoose';

export interface IModerationViolation extends Document {
    user: Schema.Types.ObjectId;
    message: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
    categories: string[];
    timestamp: Date;
}

const ModerationViolationSchema = new Schema<IModerationViolation>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Account',
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    categories: {
        type: [String],
        default: []
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Index for efficient queries
ModerationViolationSchema.index({ user: 1, timestamp: -1 });

export default models?.ModerationViolation || model<IModerationViolation>('ModerationViolation', ModerationViolationSchema);